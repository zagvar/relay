import { normalizeSymbol } from "@zagvar/relay-core";
import type {
  BarsRequest,
  MarketBar,
  MarketClock,
  MarketDataCache,
  MarketDataRequest,
  MarketQuote,
  MarketSummary,
  MarketTrade,
  OrderBookSnapshot,
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
      this.#keys.marketDataField(quote),
      JSON.stringify(quote),
    );
  }

  async getLatestQuote(request: MarketDataRequest): Promise<MarketQuote | undefined> {
    const value = await this.#client.hGet(
      this.#keys.latestQuotes(),
      this.#keys.marketDataField(request),
    );

    return value === null ? undefined : (JSON.parse(value) as MarketQuote);
  }

  async setLatestTrade(trade: MarketTrade): Promise<void> {
    await this.#client.hSet(
      this.#keys.latestTrades(),
      this.#keys.marketDataField(trade),
      JSON.stringify(trade),
    );
  }

  async getLatestTrade(request: MarketDataRequest): Promise<MarketTrade | undefined> {
    const value = await this.#client.hGet(
      this.#keys.latestTrades(),
      this.#keys.marketDataField(request),
    );

    return value === null ? undefined : (JSON.parse(value) as MarketTrade);
  }

  async setOrderBookSnapshot(snapshot: OrderBookSnapshot): Promise<void> {
    await this.#setJson(
      this.#keys.orderBookSnapshot({
        symbol: snapshot.symbol,
        ...(snapshot.venue === undefined ? {} : { venue: snapshot.venue }),
      }),
      snapshot,
      undefined,
    );
  }

  async getOrderBookSnapshot(request: MarketDataRequest): Promise<OrderBookSnapshot | undefined> {
    const value = await this.#client.get(this.#keys.orderBookSnapshot(request));

    return value === null ? undefined : (JSON.parse(value) as OrderBookSnapshot);
  }

  async setMarketSummary(marketSummary: MarketSummary): Promise<void> {
    await this.#client.hSet(
      this.#keys.marketSummaries(),
      normalizeSymbol(marketSummary.symbol),
      JSON.stringify(marketSummary),
    );

    await this.#expireMarketSummaries();
  }

  async getMarketSummary(symbol: string): Promise<MarketSummary | undefined> {
    const value = await this.#client.hGet(this.#keys.marketSummaries(), normalizeSymbol(symbol));

    return value === null ? undefined : (JSON.parse(value) as MarketSummary);
  }

  async setMarketSummaries(
    marketSummaries: Readonly<Record<string, MarketSummary>>,
  ): Promise<void> {
    await Promise.all(
      Object.entries(marketSummaries).map(async ([symbol, marketSummary]) => {
        await this.#client.hSet(
          this.#keys.marketSummaries(),
          normalizeSymbol(symbol),
          JSON.stringify(marketSummary),
        );
      }),
    );

    await this.#expireMarketSummaries();
  }

  async getMarketSummaries(): Promise<Readonly<Record<string, MarketSummary>>> {
    const values = await this.#client.hGetAll(this.#keys.marketSummaries());

    return Object.fromEntries(
      Object.entries(values).map(([symbol, value]) => [symbol, JSON.parse(value) as MarketSummary]),
    );
  }

  async appendBar(bar: MarketBar): Promise<void> {
    const key = this.#keys.bars(bar);
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

  async getBars(request: BarsRequest): Promise<readonly MarketBar[]> {
    const values = await this.#client.zRange(this.#keys.bars(request), 0, -1);

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

  async #expireMarketSummaries(): Promise<void> {
    if (this.#marketSummaryTtlSeconds === undefined) {
      return;
    }

    await this.#client.expire(this.#keys.marketSummaries(), this.#marketSummaryTtlSeconds);
  }

  #getBarRetentionPolicy(timeframe: string): BarRetentionPolicy {
    return {
      ...this.#barRetention?.default,
      ...this.#barRetention?.byTimeframe?.[timeframe],
    };
  }
}
