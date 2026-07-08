/** Minimal Redis commands needed by RedisMarketDataCache. */
export interface RedisCacheClient {
  hSet(key: string, field: string, value: string): Promise<number>;
  hGet(key: string, field: string): Promise<string | null>;
  set(key: string, value: string, options?: RedisSetOptions): Promise<string | null>;
  get(key: string): Promise<string | null>;
  zAdd(key: string, members: RedisSortedSetMember[]): Promise<number>;
  zRange(key: string, start: number, stop: number): Promise<string[]>;
}

/** Minimal SET options used by node-redis. */
export interface RedisSetOptions {
  readonly EX?: number;
}

/** Minimal sorted-set member shape used by node-redis. */
export interface RedisSortedSetMember {
  readonly score: number;
  readonly value: string;
}
