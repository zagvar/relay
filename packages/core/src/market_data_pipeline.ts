import { MARKET_EVENT_CHANNEL, createRelayMessage } from "./event_channel.js";
import type { RelayEventBus } from "./event_bus.js";
import { marketSummaryBatchSchema, type MarketDataCache } from "./market_data_cache.js";
import {
  marketClockSchema,
  marketSummarySchema,
  type MarketBar,
  type MarketClock,
  type MarketQuote,
  type MarketSummary,
  type MarketTrade,
} from "./market_data.js";
import { marketEventSchema, type MarketEvent } from "./market_event.js";
import type { OrderBookSnapshot, OrderBookUpdate } from "./order_book.js";
import { applyOrderBookUpdate, type OrderBookUpdateFailure } from "./order_book_reducer.js";

export type OrderBookPipelineErrorCode = "snapshot_missing" | OrderBookUpdateFailure;

/**
 * Indicates that an order-book event could not be safely reconciled.
 *
 * Applications should fetch a fresh provider snapshot before accepting more
 * incremental updates for this book.
 */
export class OrderBookPipelineError extends Error {
  readonly code: OrderBookPipelineErrorCode;

  constructor(code: OrderBookPipelineErrorCode) {
    super(`Order-book pipeline failed: ${code}.`);

    this.name = "OrderBookPipelineError";
    this.code = code;
  }
}

/** Runtime dependencies needed to process normalized market events. */
export interface MarketDataPipelineOptions {
  readonly cache: MarketDataCache;
  readonly eventBus: RelayEventBus;
}

/** Processes normalized market events into cache and pub/sub outputs. */
export class MarketDataPipeline {
  readonly #cache: MarketDataCache;
  readonly #eventBus: RelayEventBus;

  constructor(options: MarketDataPipelineOptions) {
    this.#cache = options.cache;
    this.#eventBus = options.eventBus;
  }

  /** Stores and publishes one normalized market event. */
  async processEvent(event: MarketEvent): Promise<void> {
    const parsedEvent = marketEventSchema.parse(event);

    switch (parsedEvent.type) {
      case "quote":
        await this.#processQuote(parsedEvent);
        return;

      case "trade":
        await this.#processTrade(parsedEvent);
        return;

      case "bar":
        await this.#processBar(parsedEvent);
        return;

      case "order_book_snapshot":
        await this.#processOrderBookSnapshot(parsedEvent);
        return;

      case "order_book_update":
        await this.#processOrderBookUpdate(parsedEvent);
        return;
    }
  }

  /** Stores and publishes current market summaries. */
  async processMarketSummaries(
    marketSummaries: Readonly<Record<string, MarketSummary>>,
  ): Promise<void> {
    const parsedMarketSummaries = marketSummaryBatchSchema.parse(marketSummaries);

    await this.#cache.setMarketSummaries(parsedMarketSummaries);

    for (const marketSummary of Object.values(parsedMarketSummaries)) {
      await this.#eventBus.publish(
        createRelayMessage(MARKET_EVENT_CHANNEL.marketSummary, marketSummary),
      );
    }
  }

  /** Stores and publishes one current market summary. */
  async processMarketSummary(marketSummary: MarketSummary): Promise<void> {
    const parsedMarketSummary = marketSummarySchema.parse(marketSummary);

    await this.#cache.setMarketSummary(parsedMarketSummary);

    await this.#eventBus.publish(
      createRelayMessage(MARKET_EVENT_CHANNEL.marketSummary, parsedMarketSummary),
    );
  }

  /** Stores and publishes the latest market clock. */
  async processMarketClock(clock: MarketClock): Promise<void> {
    const parsedClock = marketClockSchema.parse(clock);

    await this.#cache.setMarketClock(parsedClock);

    await this.#eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.marketClock, parsedClock));
  }

  async #processQuote(quote: MarketQuote): Promise<void> {
    await this.#cache.setLatestQuote(quote);

    await this.#eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.quote, quote));
  }

  async #processTrade(trade: MarketTrade): Promise<void> {
    await this.#cache.setLatestTrade(trade);

    await this.#eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));
  }

  async #processBar(bar: MarketBar): Promise<void> {
    await this.#cache.appendBar(bar);

    await this.#eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.bar, bar));
  }

  async #processOrderBookSnapshot(snapshot: OrderBookSnapshot): Promise<void> {
    await this.#cache.setOrderBookSnapshot(snapshot);

    await this.#eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.orderBook, snapshot));
  }

  async #processOrderBookUpdate(update: OrderBookUpdate): Promise<void> {
    const snapshot = await this.#cache.getOrderBookSnapshot({
      symbol: update.symbol,
      ...(update.venue === undefined ? {} : { venue: update.venue }),
    });

    if (snapshot === undefined) {
      throw new OrderBookPipelineError("snapshot_missing");
    }

    const result = applyOrderBookUpdate(snapshot, update);

    if (!result.applied) {
      throw new OrderBookPipelineError(result.reason);
    }

    await this.#cache.setOrderBookSnapshot(result.snapshot);

    await this.#eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.orderBook, update));
  }
}
