import {
  barsRequestSchema,
  marketBarSchema,
  marketClockSchema,
  marketQuoteSchema,
  marketSummaryBatchSchema,
  marketSummarySchema,
  marketTradeSchema,
  normalizeSymbol,
  orderBookSnapshotSchema,
} from "@zagvar/relay-core";
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

    assertPositiveSafeInteger(options.marketSummaryTtlSeconds, "marketSummaryTtlSeconds");

    assertPositiveSafeInteger(options.marketClockTtlSeconds, "marketClockTtlSeconds");

    this.#marketSummaryTtlSeconds = options.marketSummaryTtlSeconds;
    this.#marketClockTtlSeconds = options.marketClockTtlSeconds;
    this.#barRetention = validateBarRetentionOptions(options.barRetention);
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

    return value === null ? undefined : marketQuoteSchema.parse(parseStoredJson(value));
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

    return value === null ? undefined : marketTradeSchema.parse(parseStoredJson(value));
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

    return value === null ? undefined : orderBookSnapshotSchema.parse(parseStoredJson(value));
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

    return value === null ? undefined : marketSummarySchema.parse(parseStoredJson(value));
  }

  async setMarketSummaries(
    marketSummaries: Readonly<Record<string, MarketSummary>>,
  ): Promise<void> {
    const parsedMarketSummaries = marketSummaryBatchSchema.parse(marketSummaries);

    await Promise.all(
      Object.entries(parsedMarketSummaries).map(async ([symbol, marketSummary]) => {
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
      Object.entries(values).map(([symbol, value]) => [
        symbol,
        marketSummarySchema.parse(parseStoredJson(value)),
      ]),
    );
  }

  async appendBar(bar: MarketBar): Promise<void> {
    const parsedBar = marketBarSchema.parse(bar);
    const key = this.#keys.bars(parsedBar);
    const score = Date.parse(parsedBar.timestamp);
    const retentionPolicy = this.#getBarRetentionPolicy(parsedBar.timeframe);
    const transaction = this.#client.multi();

    transaction.zRemRangeByScore(key, score, score);

    transaction.zAdd(key, [
      {
        score,
        value: JSON.stringify(parsedBar),
      },
    ]);

    if (retentionPolicy.maxBars !== undefined) {
      transaction.zRemRangeByRank(key, 0, -(retentionPolicy.maxBars + 1));
    }

    if (retentionPolicy.ttlSeconds !== undefined) {
      transaction.expire(key, retentionPolicy.ttlSeconds);
    }

    await transaction.exec();
  }

  async getBars(request: BarsRequest): Promise<readonly MarketBar[]> {
    const parsedRequest = barsRequestSchema.parse(request);
    const key = this.#keys.bars(parsedRequest);

    const minimumScore =
      parsedRequest.start === undefined ? "-inf" : Date.parse(parsedRequest.start);

    const maximumScore = parsedRequest.end === undefined ? "+inf" : Date.parse(parsedRequest.end);

    if (parsedRequest.limit === undefined) {
      const values = await this.#client.zRange(key, minimumScore, maximumScore, {
        BY: "SCORE",
      });

      return values.map((value) => marketBarSchema.parse(parseStoredJson(value)));
    }

    const descendingValues = await this.#client.zRange(key, maximumScore, minimumScore, {
      BY: "SCORE",
      REV: true,
      LIMIT: {
        offset: 0,
        count: parsedRequest.limit,
      },
    });

    return [...descendingValues]
      .reverse()
      .map((value) => marketBarSchema.parse(parseStoredJson(value)));
  }

  async setMarketClock(clock: MarketClock): Promise<void> {
    await this.#setJson(this.#keys.marketClock(), clock, this.#marketClockTtlSeconds);
  }

  async getMarketClock(): Promise<MarketClock | undefined> {
    const value = await this.#client.get(this.#keys.marketClock());

    return value === null ? undefined : marketClockSchema.parse(parseStoredJson(value));
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

function validateBarRetentionOptions(
  options: BarRetentionOptions | undefined,
): BarRetentionOptions | undefined {
  if (options === undefined) {
    return undefined;
  }

  const defaultPolicy =
    options.default === undefined
      ? undefined
      : validateBarRetentionPolicy(options.default, "barRetention.default");

  const byTimeframe =
    options.byTimeframe === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(options.byTimeframe).map(([timeframe, policy]) => {
            if (timeframe.length === 0 || timeframe.length > 32 || timeframe !== timeframe.trim()) {
              throw new TypeError(
                "barRetention.byTimeframe keys must be non-blank identifiers without surrounding whitespace.",
              );
            }

            return [
              timeframe,
              validateBarRetentionPolicy(policy, `barRetention.byTimeframe.${timeframe}`),
            ];
          }),
        );

  return {
    ...(defaultPolicy === undefined ? {} : { default: defaultPolicy }),
    ...(byTimeframe === undefined ? {} : { byTimeframe }),
  };
}

function validateBarRetentionPolicy(
  policy: BarRetentionPolicy,
  fieldName: string,
): BarRetentionPolicy {
  assertPositiveSafeInteger(policy.maxBars, `${fieldName}.maxBars`, Number.MAX_SAFE_INTEGER - 1);

  assertPositiveSafeInteger(policy.ttlSeconds, `${fieldName}.ttlSeconds`);

  return {
    ...(policy.maxBars === undefined ? {} : { maxBars: policy.maxBars }),
    ...(policy.ttlSeconds === undefined ? {} : { ttlSeconds: policy.ttlSeconds }),
  };
}

function assertPositiveSafeInteger(
  value: number | undefined,
  fieldName: string,
  maximum = Number.MAX_SAFE_INTEGER,
): void {
  if (value === undefined) {
    return;
  }

  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new RangeError(
      `${fieldName} must be a positive safe integer no greater than ${String(maximum)}.`,
    );
  }
}

function parseStoredJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}
