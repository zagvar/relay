import type { MarketDataHydrator } from "@zagvar/relay-core";
import {
  MARKET_EVENT_CHANNEL,
  MarketDataSubscriptionState,
  type RelayEventBus,
  type RelayMessage,
  type Unsubscribe,
} from "@zagvar/relay-core";
import { parseRelayClientMessage, type RelayClientMessage } from "./client_message.js";
import { RelaySocketBackpressureError, sendJson, type RelaySocket } from "./socket.js";

export const DEFAULT_RELAY_CLIENT_MAX_SUBSCRIPTIONS = 2_000;
export const DEFAULT_RELAY_CLIENT_MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

/** Raised when a client would exceed its cumulative subscription limit. */
export class RelayClientSubscriptionLimitError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`Relay client cannot hold more than ${String(limit)} subscriptions.`);

    this.name = "RelayClientSubscriptionLimitError";
    this.limit = limit;
  }
}

/** Raised when work is requested after a session has closed. */
export class RelayClientSessionClosedError extends Error {
  constructor() {
    super("Relay client session is closed.");
    this.name = "RelayClientSessionClosedError";
  }
}

/** Runtime dependencies for one Relay WebSocket client session. */
export interface RelayClientSessionOptions {
  readonly socket: RelaySocket;
  readonly eventBus: RelayEventBus;
  readonly hydrator?: MarketDataHydrator;
  /** Maximum outbound bytes queued for this connection. */
  readonly maxBufferedBytes?: number;
  /** Receives outbound transport errors for this session. */
  readonly onError?: (error: unknown) => void;

  /**
   * Maximum number of distinct subscriptions retained by this connection.
   *
   * Defaults to `DEFAULT_RELAY_CLIENT_MAX_SUBSCRIPTIONS`.
   */
  readonly maxSubscriptions?: number;
}

/** Handles one connected Relay WebSocket client. */
export class RelayClientSession {
  readonly #socket: RelaySocket;
  readonly #eventBus: RelayEventBus;
  readonly #hydrator: MarketDataHydrator | undefined;
  readonly #subscriptions = new MarketDataSubscriptionState();
  readonly #unsubscribes: Unsubscribe[] = [];
  readonly #maxSubscriptions: number;
  readonly #maxBufferedBytes: number;
  readonly #onError: ((error: unknown) => void) | undefined;
  #startPromise: Promise<void> | undefined;
  #closePromise: Promise<void> | undefined;
  #closed = false;
  #sendQueue: Promise<void> = Promise.resolve();

  constructor(options: RelayClientSessionOptions) {
    this.#socket = options.socket;
    this.#eventBus = options.eventBus;
    this.#hydrator = options.hydrator;
    this.#maxSubscriptions = resolveRelayClientMaxSubscriptions(options.maxSubscriptions);
    this.#maxBufferedBytes = resolveRelayClientMaxBufferedBytes(options.maxBufferedBytes);
    this.#onError = options.onError;
  }

  /** Starts forwarding Relay bus messages to this client. */
  async start(): Promise<void> {
    if (this.#closed) {
      throw new RelayClientSessionClosedError();
    }

    if (this.#startPromise !== undefined) {
      await this.#startPromise;
      return;
    }

    const startPromise = this.#startInternal();
    this.#startPromise = startPromise;

    try {
      await startPromise;
    } catch (error: unknown) {
      if (this.#startPromise === startPromise) {
        this.#startPromise = undefined;
      }

      throw error;
    }
  }

  /** Handles one raw client message. */
  async handleMessage(rawMessage: string): Promise<void> {
    if (this.#closed) {
      throw new RelayClientSessionClosedError();
    }

    await this.#handleClientMessage(parseRelayClientMessage(rawMessage));
  }

  /** Closes this session and removes event bus subscriptions. */
  close(): Promise<void> {
    if (this.#closePromise !== undefined) {
      return this.#closePromise;
    }

    this.#closed = true;
    this.#closePromise = this.#closeInternal();

    return this.#closePromise;
  }

  async #startInternal(): Promise<void> {
    const unsubscribes: Unsubscribe[] = [];

    try {
      for (const channel of [
        MARKET_EVENT_CHANNEL.quote,
        MARKET_EVENT_CHANNEL.trade,
        MARKET_EVENT_CHANNEL.bar,
        MARKET_EVENT_CHANNEL.orderBook,
        MARKET_EVENT_CHANNEL.marketSummary,
        MARKET_EVENT_CHANNEL.marketClock,
      ] as const) {
        const unsubscribe = await this.#eventBus.subscribe(channel, (message) =>
          this.#forwardMessage(message),
        );

        unsubscribes.push(unsubscribe);
      }
    } catch (error: unknown) {
      await Promise.allSettled(unsubscribes.map(async (unsubscribe) => unsubscribe()));

      throw error;
    }

    this.#unsubscribes.push(...unsubscribes);
  }

  async #closeInternal(): Promise<void> {
    if (this.#startPromise !== undefined) {
      try {
        await this.#startPromise;
      } catch {
        // Partial startup performs its own rollback.
      }
    }

    const unsubscribes = this.#unsubscribes.splice(0, this.#unsubscribes.length);

    const results = await Promise.allSettled(
      unsubscribes.map(async (unsubscribe) => unsubscribe()),
    );

    this.#subscriptions.clear();

    const errors: unknown[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        const reason: unknown = result.reason;
        errors.push(reason);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        "Failed to remove one or more Relay event-bus subscriptions.",
      );
    }
  }

  async #handleClientMessage(message: RelayClientMessage): Promise<void> {
    switch (message.type) {
      case "subscribe_channels": {
        const additionalSubscriptions = message.channels.filter(
          (channel) => !this.#subscriptions.hasChannel(channel),
        ).length;

        this.#assertSubscriptionCapacity(additionalSubscriptions);

        for (const channel of message.channels) {
          this.#subscriptions.subscribeChannel(channel);
        }

        return;
      }

      case "unsubscribe_channels":
        for (const channel of message.channels) {
          this.#subscriptions.unsubscribeChannel(channel);
        }
        return;

      case "subscribe_market_summaries": {
        const additionalSubscriptions = message.symbols.filter(
          (symbol) => !this.#subscriptions.hasMarketSummarySymbol(symbol),
        ).length;

        this.#assertSubscriptionCapacity(additionalSubscriptions);

        this.#subscriptions.subscribeMarketSummaries(message.symbols);

        return;
      }

      case "unsubscribe_market_summaries":
        this.#subscriptions.unsubscribeMarketSummaries(message.symbols);
        return;

      case "subscribe_quotes": {
        const additionalSubscriptions = message.quotes.filter(
          (request) => !this.#subscriptions.hasQuoteSubscription(request),
        ).length;

        this.#assertSubscriptionCapacity(additionalSubscriptions);

        this.#subscriptions.subscribeQuotes(message.quotes);

        return;
      }

      case "unsubscribe_quotes":
        this.#subscriptions.unsubscribeQuotes(message.quotes);
        return;

      case "subscribe_trades": {
        const additionalSubscriptions = message.trades.filter(
          (request) => !this.#subscriptions.hasTradeSubscription(request),
        ).length;

        this.#assertSubscriptionCapacity(additionalSubscriptions);

        this.#subscriptions.subscribeTrades(message.trades);

        return;
      }

      case "unsubscribe_trades":
        this.#subscriptions.unsubscribeTrades(message.trades);
        return;

      case "subscribe_order_books": {
        const additionalSubscriptions = message.orderBooks.filter(
          (request) => !this.#subscriptions.hasOrderBookSubscription(request),
        ).length;

        this.#assertSubscriptionCapacity(additionalSubscriptions);

        this.#subscriptions.subscribeOrderBooks(message.orderBooks);

        return;
      }

      case "unsubscribe_order_books":
        this.#subscriptions.unsubscribeOrderBooks(message.orderBooks);
        return;

      case "subscribe_bars": {
        const additionalSubscriptions = message.bars.filter(
          (bar) => !this.#subscriptions.hasBarSubscription(bar),
        ).length;

        this.#assertSubscriptionCapacity(additionalSubscriptions);

        for (const bar of message.bars) {
          this.#subscriptions.subscribeBars(bar);
        }

        return;
      }

      case "unsubscribe_bars":
        for (const bar of message.bars) {
          this.#subscriptions.unsubscribeBars(bar);
        }
        return;

      case "hydrate": {
        if (this.#hydrator === undefined) {
          throw new Error("Hydration is not configured for this session.");
        }

        const hydration = await this.#hydrator.hydrate(message.request);

        if (this.#closed) {
          return;
        }

        await this.#sendPayload({
          type: "hydration",
          data: hydration,
        });

        return;
      }
    }
  }

  get #subscriptionCount(): number {
    return (
      this.#subscriptions.channels.length +
      this.#subscriptions.marketSummarySymbols.length +
      this.#subscriptions.quoteKeys.length +
      this.#subscriptions.tradeKeys.length +
      this.#subscriptions.orderBookKeys.length +
      this.#subscriptions.barKeys.length
    );
  }

  #assertSubscriptionCapacity(additionalSubscriptions: number): void {
    if (additionalSubscriptions > this.#maxSubscriptions - this.#subscriptionCount) {
      throw new RelayClientSubscriptionLimitError(this.#maxSubscriptions);
    }
  }

  async #sendPayload(payload: unknown): Promise<void> {
    try {
      await this.#enqueuePayload(payload);
    } catch (error: unknown) {
      await this.#handleOutboundError(error);
    }
  }

  #enqueuePayload(payload: unknown): Promise<void> {
    const sendPromise = this.#sendQueue.then(async () => {
      if (this.#closed) {
        return;
      }

      await sendJson(this.#socket, payload, {
        maxBufferedBytes: this.#maxBufferedBytes,
      });
    });

    this.#sendQueue = sendPromise.then(
      () => undefined,
      () => undefined,
    );

    return sendPromise;
  }

  async #handleOutboundError(error: unknown): Promise<void> {
    this.#notifyError(error);

    const isBackpressureError = error instanceof RelaySocketBackpressureError;

    const closeCode = isBackpressureError ? 1013 : 1011;

    const closeReason = isBackpressureError
      ? "Relay client is consuming messages too slowly."
      : "Relay outbound message failed.";

    const closeSocket = async (): Promise<void> => {
      await Promise.resolve(this.#socket.close(closeCode, closeReason));
    };

    const cleanupResults = await Promise.allSettled([this.close(), closeSocket()]);

    for (const result of cleanupResults) {
      if (result.status === "rejected") {
        const cleanupError: unknown = result.reason;
        this.#notifyError(cleanupError);
      }
    }
  }

  #notifyError(error: unknown): void {
    try {
      this.#onError?.(error);
    } catch {
      // Error handlers must not prevent session cleanup.
    }
  }

  async #forwardMessage(message: RelayMessage): Promise<void> {
    if (this.#closed) {
      return;
    }

    if (!this.#shouldForwardMessage(message)) {
      return;
    }

    await this.#sendPayload({
      type: "relay_message",
      data: message,
    });
  }

  #shouldForwardMessage(message: RelayMessage): boolean {
    switch (message.channel) {
      case MARKET_EVENT_CHANNEL.marketSummary:
        return this.#subscriptions.hasMarketSummarySymbol(message.data.symbol);

      case MARKET_EVENT_CHANNEL.quote:
        return this.#subscriptions.hasQuoteSubscription(message.data);

      case MARKET_EVENT_CHANNEL.trade:
        return this.#subscriptions.hasTradeSubscription(message.data);

      case MARKET_EVENT_CHANNEL.orderBook:
        return this.#subscriptions.hasOrderBookSubscription(message.data);

      case MARKET_EVENT_CHANNEL.bar:
        return this.#subscriptions.hasBarSubscription(message.data);

      case MARKET_EVENT_CHANNEL.marketClock:
        return this.#subscriptions.hasChannel(message.channel);
    }
  }
}

export function resolveRelayClientMaxSubscriptions(configuredLimit: number | undefined): number {
  const limit = configuredLimit ?? DEFAULT_RELAY_CLIENT_MAX_SUBSCRIPTIONS;

  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("maxSubscriptions must be a positive safe integer.");
  }

  return limit;
}

export function resolveRelayClientMaxBufferedBytes(configuredLimit: number | undefined): number {
  const limit = configuredLimit ?? DEFAULT_RELAY_CLIENT_MAX_BUFFERED_BYTES;

  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("maxBufferedBytes must be a positive safe integer.");
  }

  return limit;
}
