import { MARKET_EVENT_CHANNEL, createRelayMessage } from "./event_channel.js";
import type { RelayEventBus } from "./event_bus.js";
import type { MarketDataCache } from "./market_data_cache.js";
import type {
  MarketBar,
  MarketClock,
  MarketEvent,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "./market_data.js";

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
    switch (event.type) {
      case "quote":
        await this.#processQuote(event);
        return;
      case "trade":
        await this.#processTrade(event);
        return;
      case "bar":
        await this.#processBar(event);
        return;
    }
  }

  /** Stores and publishes latest marketSummaries. */
  async processMarketSummaries(
    marketSummaries: Readonly<Record<string, MarketSummary>>,
  ): Promise<void> {
    await this.#cache.setMarketSummaries(marketSummaries);
    await this.#eventBus.publish(
      createRelayMessage(MARKET_EVENT_CHANNEL.marketSummary, marketSummaries),
    );
  }

  /** Stores and publishes the latest market clock. */
  async processMarketClock(clock: MarketClock): Promise<void> {
    await this.#cache.setMarketClock(clock);
    await this.#eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.marketClock, clock));
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
}
