import type { MarketDataHydrator } from "@zagvar/relay-core";
import {
  MARKET_EVENT_CHANNEL,
  MarketDataSubscriptionState,
  type BarSubscription,
  type RelayEventBus,
  type RelayMessage,
  type Unsubscribe,
} from "@zagvar/relay-core";
import { parseRelayClientMessage, type RelayClientMessage } from "./client_message.js";
import { sendJson, type RelaySocket } from "./socket.js";
import { isRecord } from "./type_guards.js";

/** Runtime dependencies for one Relay WebSocket client session. */
export interface RelayClientSessionOptions {
  readonly socket: RelaySocket;
  readonly eventBus: RelayEventBus;
  readonly hydrator?: MarketDataHydrator;
}

/** Handles one connected Relay WebSocket client. */
export class RelayClientSession {
  readonly #socket: RelaySocket;
  readonly #eventBus: RelayEventBus;
  readonly #hydrator: MarketDataHydrator | undefined;
  readonly #subscriptions = new MarketDataSubscriptionState();
  readonly #unsubscribes: Unsubscribe[] = [];

  constructor(options: RelayClientSessionOptions) {
    this.#socket = options.socket;
    this.#eventBus = options.eventBus;
    this.#hydrator = options.hydrator;
  }

  /** Starts forwarding Relay bus messages to this client. */
  async start(): Promise<void> {
    this.#unsubscribes.push(
      await this.#eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) =>
        this.#forwardMessage(message),
      ),
      await this.#eventBus.subscribe(MARKET_EVENT_CHANNEL.bar, (message) =>
        this.#forwardMessage(message),
      ),
      await this.#eventBus.subscribe(MARKET_EVENT_CHANNEL.marketSummary, (message) =>
        this.#forwardMessage(message),
      ),
      await this.#eventBus.subscribe(MARKET_EVENT_CHANNEL.marketClock, (message) =>
        this.#forwardMessage(message),
      ),
    );
  }

  /** Handles one raw client message. */
  async handleMessage(rawMessage: string): Promise<void> {
    await this.#handleClientMessage(parseRelayClientMessage(rawMessage));
  }

  /** Closes this session and removes event bus subscriptions. */
  async close(): Promise<void> {
    await Promise.all(this.#unsubscribes.map((unsubscribe) => unsubscribe()));
    this.#unsubscribes.length = 0;
    this.#subscriptions.clear();
  }

  async #handleClientMessage(message: RelayClientMessage): Promise<void> {
    switch (message.type) {
      case "subscribe_channels":
        for (const channel of message.channels) {
          this.#subscriptions.subscribeChannel(channel);
        }
        return;
      case "unsubscribe_channels":
        for (const channel of message.channels) {
          this.#subscriptions.unsubscribeChannel(channel);
        }
        return;
      case "subscribe_trades":
        this.#subscriptions.subscribeTrades(message.symbols);
        return;
      case "unsubscribe_trades":
        this.#subscriptions.unsubscribeTrades(message.symbols);
        return;
      case "subscribe_bars":
        for (const bar of message.bars) {
          this.#subscriptions.subscribeBars(bar);
        }
        return;
      case "unsubscribe_bars":
        for (const bar of message.bars) {
          this.#subscriptions.unsubscribeBars(bar);
        }
        return;
      case "hydrate":
        if (this.#hydrator === undefined) {
          throw new Error("Hydration is not configured for this session.");
        }

        await sendJson(this.#socket, {
          type: "hydration",
          data: await this.#hydrator.hydrate(message.request),
        });
        return;
    }
  }

  async #forwardMessage(message: RelayMessage<unknown>): Promise<void> {
    if (!this.#shouldForwardMessage(message)) {
      return;
    }

    await sendJson(this.#socket, {
      type: "relay_message",
      data: message,
    });
  }

  #shouldForwardMessage(message: RelayMessage<unknown>): boolean {
    if (message.channel === MARKET_EVENT_CHANNEL.trade) {
      return this.#shouldForwardTrade(message.data);
    }

    if (message.channel === MARKET_EVENT_CHANNEL.bar) {
      return this.#shouldForwardBar(message.data);
    }

    return this.#subscriptions.hasChannel(message.channel);
  }

  #shouldForwardTrade(data: unknown): boolean {
    return isTradeEventData(data) && this.#subscriptions.hasTradeSymbol(data.symbol);
  }

  #shouldForwardBar(data: unknown): boolean {
    return isBarEventData(data) && this.#subscriptions.hasBarSubscription(data);
  }
}

interface TradeEventData {
  readonly type: "trade";
  readonly symbol: string;
}

interface BarEventData extends BarSubscription {
  readonly type: "bar";
}

function isTradeEventData(value: unknown): value is TradeEventData {
  return isRecord(value) && value.type === "trade" && typeof value.symbol === "string";
}

function isBarEventData(value: unknown): value is BarEventData {
  return (
    isRecord(value) &&
    value.type === "bar" &&
    typeof value.symbol === "string" &&
    typeof value.timeframe === "string"
  );
}
