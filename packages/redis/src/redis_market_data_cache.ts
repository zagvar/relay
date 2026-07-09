import { normalizeSymbol } from "@zagvar/relay-core";
import type {
  MarketBar,
  MarketClock,
  MarketDataCache,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "@zagvar/relay-core";
import { RelayRedisKeys, type RelayRedisKeyOptions } from "./redis_keys.js";
import type { RedisCacheClient } from "./redis_client.js";

/** Retention policy for cached bar series. */
export interface BarRetentionPolicy {
  readonly maxBars?: number;
  readonly ttlSeconds?: number;
}

/** Timeframe-specific bar retention configuration. */
export interface BarRetentionOptions {
  readonly default?: BarRetentionPolicy;
  readonly byTimeframe?: Readonly<Record<string, BarRetentionPolicy>>;
}

/** Options for RedisMarketDataCache. */
export interface RedisMarketDataCacheOptions extends RelayRedisKeyOptions {
  readonly client: RedisCacheClient;
  readonly marketSummaryTtlSeconds?: number;
  readonly marketClockTtlSeconds?: number;
  readonly barRetention?: BarRetentionOptions;
}

/** Redis-backed implementation of Relay's market data cache contract. */
export class RedisMarketDataCache implements MarketDataCache {
  readonly #client: RedisCacheClient;
  readonly #keys: RelayRedisKeys;
  readonly #marketSummaryTtlSeconds: number | undefined;
  readonly #marketClockTtlSeconds: number | undefined;
  readonly #barRetention: BarRetentionOptions | undefined;

  constructor(options: RedisMarketDataCacheOptions) {
    this.#client = options.client;
    this.#keys =
      options.prefix === undefined
        ? new RelayRedisKeys()
        : new RelayRedisKeys({ prefix: options.prefix });
    this.#marketSummaryTtlSeconds = options.marketSummaryTtlSeconds;
    this.#marketClockTtlSeconds = options.marketClockTtlSeconds;
    this.#barRetention = options.barRetention;
  }

  async setLatestQuote(quote: MarketQuote): Promise<void> {
    await this.#client.hSet(
      this.#keys.latestQuotes(),
      normalizeSymbol(quote.symbol),
      JSON.stringify(quote),
    );
  }

  async getLatestQuote(symbol: string): Promise<MarketQuote | undefined> {
    const value = await this.#client.hGet(this.#keys.latestQuotes(), normalizeSymbol(symbol));

    return value === null ? undefined : (JSON.parse(value) as MarketQuote);
  }

  async setLatestTrade(trade: MarketTrade): Promise<void> {
    await this.#client.hSet(
      this.#keys.latestTrades(),
      normalizeSymbol(trade.symbol),
      JSON.stringify(trade),
    );
  }

  async getLatestTrade(symbol: string): Promise<MarketTrade | undefined> {
    const value = await this.#client.hGet(this.#keys.latestTrades(), normalizeSymbol(symbol));

    return value === null ? undefined : (JSON.parse(value) as MarketTrade);
  }

  async setMarketSummaries(
    marketSummaries: Readonly<Record<string, MarketSummary>>,
  ): Promise<void> {
    const normalizedMarketSummaries = Object.fromEntries(
      Object.entries(marketSummaries).map(([symbol, marketSummary]) => [
        normalizeSymbol(symbol),
        marketSummary,
      ]),
    );

    await this.#setJson(
      this.#keys.marketSummaries(),
      normalizedMarketSummaries,
      this.#marketSummaryTtlSeconds,
    );
  }

  async getMarketSummaries(): Promise<Readonly<Record<string, MarketSummary>>> {
    const value = await this.#client.get(this.#keys.marketSummaries());

    return value === null ? {} : (JSON.parse(value) as Readonly<Record<string, MarketSummary>>);
  }

  async appendBar(bar: MarketBar): Promise<void> {
    const key = this.#keys.bars(bar.symbol, bar.timeframe);
    const score = new Date(bar.timestamp).getTime();
    const retentionPolicy = this.#getBarRetentionPolicy(bar.timeframe);

    await this.#client.zAdd(key, [{ score, value: JSON.stringify(bar) }]);

    if (retentionPolicy.maxBars !== undefined) {
      await this.#client.zRemRangeByRank(key, 0, -(retentionPolicy.maxBars + 1));
    }

    if (retentionPolicy.ttlSeconds !== undefined) {
      await this.#client.expire(key, retentionPolicy.ttlSeconds);
    }
  }

  async getBars(symbol: string, timeframe: string): Promise<readonly MarketBar[]> {
    const values = await this.#client.zRange(this.#keys.bars(symbol, timeframe), 0, -1);

    return values.map((value) => JSON.parse(value) as MarketBar);
  }

  async setMarketClock(clock: MarketClock): Promise<void> {
    await this.#setJson(this.#keys.marketClock(), clock, this.#marketClockTtlSeconds);
  }

  async getMarketClock(): Promise<MarketClock | undefined> {
    const value = await this.#client.get(this.#keys.marketClock());

    return value === null ? undefined : (JSON.parse(value) as MarketClock);
  }

  async #setJson(key: string, value: unknown, ttlSeconds: number | undefined): Promise<void> {
    const serializedValue = JSON.stringify(value);

    if (ttlSeconds === undefined) {
      await this.#client.set(key, serializedValue);
      return;
    }

    await this.#client.set(key, serializedValue, { EX: ttlSeconds });
  }

  #getBarRetentionPolicy(timeframe: string): BarRetentionPolicy {
    return {
      ...this.#barRetention?.default,
      ...this.#barRetention?.byTimeframe?.[timeframe],
    };
  }
}
