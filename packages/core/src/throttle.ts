/** Tracks whether keyed events should be emitted under a fixed throttle window. */
export class EventThrottle {
  readonly #lastEmittedAt = new Map<string, number>();
  readonly #windowMs: number;

  constructor(windowMs: number) {
    if (windowMs <= 0) {
      throw new Error("windowMs must be greater than zero.");
    }

    this.#windowMs = windowMs;
  }

  /** Returns true when the key may emit at the given timestamp. */
  shouldEmit(key: string, nowMs: number): boolean {
    const lastEmittedAt = this.#lastEmittedAt.get(key);

    if (lastEmittedAt === undefined || nowMs - lastEmittedAt >= this.#windowMs) {
      this.#lastEmittedAt.set(key, nowMs);
      return true;
    }

    return false;
  }

  /** Removes keys that have not emitted within the provided age. */
  prune(nowMs: number, maxAgeMs: number): number {
    let deletedCount = 0;

    for (const [key, lastEmittedAt] of this.#lastEmittedAt.entries()) {
      if (nowMs - lastEmittedAt > maxAgeMs) {
        this.#lastEmittedAt.delete(key);
        deletedCount += 1;
      }
    }

    return deletedCount;
  }
}
