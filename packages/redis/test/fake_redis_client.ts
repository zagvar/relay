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
  readonly #sortedSetExpiresAtMs = new Map<string, number>();
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
    const expiresAtMs = this.#sortedSetExpiresAtMs.get(key);

    if (expiresAtMs !== undefined && this.#nowMs >= expiresAtMs) {
      this.#sortedSets.delete(key);
      this.#sortedSetExpiresAtMs.delete(key);
      return Promise.resolve([]);
    }

    const sortedSet = this.#sortedSets.get(key) ?? [];
    const normalizedStop = stop === -1 ? sortedSet.length : stop + 1;

    return Promise.resolve(sortedSet.slice(start, normalizedStop).map((member) => member.value));
  }

  zRemRangeByRank(key: string, start: number, stop: number): Promise<number> {
    const sortedSet = this.#sortedSets.get(key) ?? [];
    const normalizedStop = stop < 0 ? sortedSet.length + stop : stop;
    const deleteCount = Math.max(0, normalizedStop - start + 1);

    sortedSet.splice(start, deleteCount);

    if (sortedSet.length === 0) {
      this.#sortedSets.delete(key);
    } else {
      this.#sortedSets.set(key, sortedSet);
    }

    return Promise.resolve(deleteCount);
  }

  expire(key: string, seconds: number): Promise<number> {
    if (!this.#strings.has(key) && !this.#sortedSets.has(key)) {
      return Promise.resolve(0);
    }

    this.#sortedSetExpiresAtMs.set(key, this.#nowMs + seconds * 1_000);
    return Promise.resolve(1);
  }
}
