import type {
  RedisCacheClient,
  RedisSetOptions,
  RedisSortedSetMember,
} from "../src/redis_client.js";

interface StoredValue {
  readonly value: string;
  readonly expiresAtMs?: number;
}

/** In-memory Redis-like client for unit tests. */
export class FakeRedisClient implements RedisCacheClient {
  readonly #hashes = new Map<string, Map<string, string>>();
  readonly #strings = new Map<string, StoredValue>();
  readonly #sortedSets = new Map<string, RedisSortedSetMember[]>();
  #nowMs = 0;

  advanceTime(ms: number): void {
    this.#nowMs += ms;
  }

  hSet(key: string, field: string, value: string): Promise<number> {
    const hash = this.#hashes.get(key) ?? new Map<string, string>();
    const isNewField = !hash.has(field);

    hash.set(field, value);
    this.#hashes.set(key, hash);

    return Promise.resolve(isNewField ? 1 : 0);
  }

  hGet(key: string, field: string): Promise<string | null> {
    return Promise.resolve(this.#hashes.get(key)?.get(field) ?? null);
  }

  set(key: string, value: string, options?: RedisSetOptions): Promise<string | null> {
    const expiresAtMs = options?.EX === undefined ? undefined : this.#nowMs + options.EX * 1_000;

    this.#strings.set(key, expiresAtMs === undefined ? { value } : { value, expiresAtMs });

    return Promise.resolve("OK");
  }

  get(key: string): Promise<string | null> {
    const storedValue = this.#strings.get(key);

    if (storedValue === undefined) {
      return Promise.resolve(null);
    }

    if (storedValue.expiresAtMs !== undefined && this.#nowMs >= storedValue.expiresAtMs) {
      this.#strings.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(storedValue.value);
  }

  zAdd(key: string, members: RedisSortedSetMember[]): Promise<number> {
    const sortedSet = this.#sortedSets.get(key) ?? [];

    sortedSet.push(...members);
    sortedSet.sort((left, right) => left.score - right.score);

    this.#sortedSets.set(key, sortedSet);

    return Promise.resolve(members.length);
  }

  zRange(key: string, start: number, stop: number): Promise<string[]> {
    const sortedSet = this.#sortedSets.get(key) ?? [];
    const normalizedStop = stop === -1 ? sortedSet.length : stop + 1;

    return Promise.resolve(sortedSet.slice(start, normalizedStop).map((member) => member.value));
  }
}
