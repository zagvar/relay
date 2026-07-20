import type {
  RedisCacheClient,
  RedisCacheTransaction,
  RedisSetOptions,
  RedisSortedSetMember,
  RedisSortedSetRangeBoundary,
  RedisSortedSetRangeOptions,
} from "../src/redis_client.js";

interface StoredValue {
  readonly value: string;
  readonly expiresAtMs?: number;
}

/** In-memory Redis-like client for unit tests. */
export class FakeRedisClient implements RedisCacheClient {
  readonly #hashes = new Map<string, Map<string, string>>();
  readonly #hashExpiresAtMs = new Map<string, number>();
  readonly #strings = new Map<string, StoredValue>();
  readonly #sortedSets = new Map<string, RedisSortedSetMember[]>();
  readonly #sortedSetExpiresAtMs = new Map<string, number>();
  #nowMs = 0;

  #getHash(key: string): Map<string, string> | undefined {
    const expiresAtMs = this.#hashExpiresAtMs.get(key);

    if (expiresAtMs !== undefined && this.#nowMs >= expiresAtMs) {
      this.#hashes.delete(key);
      this.#hashExpiresAtMs.delete(key);
      return undefined;
    }

    return this.#hashes.get(key);
  }

  advanceTime(ms: number): void {
    this.#nowMs += ms;
  }

  hSet(key: string, field: string, value: string): Promise<number> {
    const hash = this.#getHash(key) ?? new Map<string, string>();
    const isNewField = !hash.has(field);

    hash.set(field, value);
    this.#hashes.set(key, hash);

    return Promise.resolve(isNewField ? 1 : 0);
  }

  hGet(key: string, field: string): Promise<string | null> {
    return Promise.resolve(this.#getHash(key)?.get(field) ?? null);
  }

  hGetAll(key: string): Promise<Record<string, string>> {
    return Promise.resolve(Object.fromEntries(this.#getHash(key) ?? []));
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

  zRange(
    key: string,
    min: RedisSortedSetRangeBoundary,
    max: RedisSortedSetRangeBoundary,
    options?: RedisSortedSetRangeOptions,
  ): Promise<string[]> {
    const expiresAtMs = this.#sortedSetExpiresAtMs.get(key);

    if (expiresAtMs !== undefined && this.#nowMs >= expiresAtMs) {
      this.#sortedSets.delete(key);
      this.#sortedSetExpiresAtMs.delete(key);

      return Promise.resolve([]);
    }

    const sortedSet = this.#sortedSets.get(key) ?? [];

    if (options?.BY === "SCORE") {
      const lowerBoundary = options.REV ? max : min;
      const upperBoundary = options.REV ? min : max;
      const lowerScore = resolveScoreBoundary(lowerBoundary);
      const upperScore = resolveScoreBoundary(upperBoundary);

      const matchingMembers = sortedSet.filter(
        (member) => member.score >= lowerScore && member.score <= upperScore,
      );

      const orderedMembers = options.REV ? matchingMembers.reverse() : matchingMembers;

      const limitedMembers =
        options.LIMIT === undefined
          ? orderedMembers
          : orderedMembers.slice(options.LIMIT.offset, options.LIMIT.offset + options.LIMIT.count);

      return Promise.resolve(limitedMembers.map((member) => member.value));
    }

    if (typeof min !== "number" || typeof max !== "number") {
      throw new TypeError("Rank ranges require numeric boundaries.");
    }

    const normalizedStop = max === -1 ? sortedSet.length : max + 1;

    return Promise.resolve(sortedSet.slice(min, normalizedStop).map((member) => member.value));
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
    if (this.#hashes.has(key)) {
      this.#hashExpiresAtMs.set(key, this.#nowMs + seconds * 1_000);

      return Promise.resolve(1);
    }

    if (!this.#strings.has(key) && !this.#sortedSets.has(key)) {
      return Promise.resolve(0);
    }

    this.#sortedSetExpiresAtMs.set(key, this.#nowMs + seconds * 1_000);
    return Promise.resolve(1);
  }

  zRemRangeByScore(
    key: string,
    min: RedisSortedSetRangeBoundary,
    max: RedisSortedSetRangeBoundary,
  ): Promise<number> {
    const sortedSet = this.#sortedSets.get(key) ?? [];
    const minimumScore = resolveScoreBoundary(min);
    const maximumScore = resolveScoreBoundary(max);

    const retainedMembers = sortedSet.filter(
      (member) => member.score < minimumScore || member.score > maximumScore,
    );

    const removedCount = sortedSet.length - retainedMembers.length;

    if (retainedMembers.length === 0) {
      this.#sortedSets.delete(key);
    } else {
      this.#sortedSets.set(key, retainedMembers);
    }

    return Promise.resolve(removedCount);
  }

  multi(): RedisCacheTransaction {
    return new FakeRedisTransaction(this);
  }
}

class FakeRedisTransaction implements RedisCacheTransaction {
  readonly #client: FakeRedisClient;
  readonly #operations: (() => Promise<unknown>)[] = [];

  constructor(client: FakeRedisClient) {
    this.#client = client;
  }

  zAdd(key: string, members: RedisSortedSetMember[]): this {
    this.#operations.push(() => this.#client.zAdd(key, members));

    return this;
  }

  zRemRangeByRank(key: string, start: number, stop: number): this {
    this.#operations.push(() => this.#client.zRemRangeByRank(key, start, stop));

    return this;
  }

  zRemRangeByScore(
    key: string,
    min: RedisSortedSetRangeBoundary,
    max: RedisSortedSetRangeBoundary,
  ): this {
    this.#operations.push(() => this.#client.zRemRangeByScore(key, min, max));

    return this;
  }

  expire(key: string, seconds: number): this {
    this.#operations.push(() => this.#client.expire(key, seconds));

    return this;
  }

  async exec(): Promise<readonly unknown[]> {
    const results: unknown[] = [];

    for (const operation of this.#operations) {
      results.push(await operation());
    }

    return results;
  }
}

function resolveScoreBoundary(boundary: RedisSortedSetRangeBoundary): number {
  if (boundary === "-inf") {
    return Number.NEGATIVE_INFINITY;
  }

  if (boundary === "+inf") {
    return Number.POSITIVE_INFINITY;
  }

  return boundary;
}
