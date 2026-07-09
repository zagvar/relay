/** Minimal Redis commands needed by RedisMarketDataCache. */
export interface RedisCacheClient {
  hSet(key: string, field: string, value: string): Promise<number>;
  hGet(key: string, field: string): Promise<string | null>;
  hGetAll(key: string): Promise<Record<string, string>>;
  set(key: string, value: string, options?: RedisSetOptions): Promise<string | null>;
  get(key: string): Promise<string | null>;
  zAdd(key: string, members: RedisSortedSetMember[]): Promise<number>;
  zRange(key: string, start: number, stop: number): Promise<string[]>;
  zRemRangeByRank(key: string, start: number, stop: number): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
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

/** Handles raw Redis Pub/Sub messages. */
export type RedisMessageHandler = (message: string) => void | Promise<void>;

/** Minimal Redis publish client needed by RedisRelayEventBus. */
export interface RedisPublishClient {
  publish(channel: string, message: string): Promise<number>;
}

/** Minimal Redis subscribe client needed by RedisRelayEventBus. */
export interface RedisSubscribeClient {
  subscribe(channel: string, handler: RedisMessageHandler): Promise<void>;
  unsubscribe(channel: string, handler?: RedisMessageHandler): Promise<void>;
}
