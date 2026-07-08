import { normalizeSymbol } from "@zagvar/relay-core";
import type {
  MarketBar,
  MarketClock,
  MarketDataCache,
  MarketSnapshot,
  MarketTrade,
} from "@zagvar/relay-core";
import { RelayRedisKeys, type RelayRedisKeyOptions } from "./redis_keys.js";
import type { RedisCacheClient } from "./redis_client.js";

/** Options for RedisMarketDataCache. */
export interface RedisMarketDataCacheOptions extends RelayRedisKeyOptions {
  readonly client: RedisCacheClient;
  readonly snapshotTtlSeconds?: number;
  readonly marketClockTtlSeconds?: number;
  readonly barLimit?: number;
}

/** Redis-backed implementation of Relay's market data cache contract. */
export class RedisMarketDataCache implements MarketDataCache {
  readonly #client: RedisCacheClient;
  readonly #keys: RelayRedisKeys;
  readonly #snapshotTtlSeconds: number | undefined;
  readonly #marketClockTtlSeconds: number | undefined;
  readonly #barLimit: number | undefined;

  constructor(options: RedisMarketDataCacheOptions) {
    this.#client = options.client;
    this.#keys =
      options.prefix === undefined
        ? new RelayRedisKeys()
        : new RelayRedisKeys({ prefix: options.prefix });
    this.#snapshotTtlSeconds = options.snapshotTtlSeconds;
    this.#marketClockTtlSeconds = options.marketClockTtlSeconds;
    this.#barLimit = options.barLimit;
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

  async setSnapshots(snapshots: Readonly<Record<string, MarketSnapshot>>): Promise<void> {
    const normalizedSnapshots = Object.fromEntries(
      Object.entries(snapshots).map(([symbol, snapshot]) => [normalizeSymbol(symbol), snapshot]),
    );

    await this.#setJson(this.#keys.snapshots(), normalizedSnapshots, this.#snapshotTtlSeconds);
  }

  async getSnapshots(): Promise<Readonly<Record<string, MarketSnapshot>>> {
    const value = await this.#client.get(this.#keys.snapshots());

    return value === null ? {} : (JSON.parse(value) as Readonly<Record<string, MarketSnapshot>>);
  }

  async appendBar(bar: MarketBar): Promise<void> {
    const key = this.#keys.bars(bar.symbol, bar.timeframe);
    const score = new Date(bar.timestamp).getTime();

    await this.#client.zAdd(key, [{ score, value: JSON.stringify(bar) }]);

    // Trimming is intentionally deferred until we expose the extra Redis commands
    // in the client interface. The first version keeps writes simple and portable.
    void this.#barLimit;
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
}
