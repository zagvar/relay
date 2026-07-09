import type { MarketSummary } from "./market_data.js";
import { normalizeSymbol } from "./symbols.js";

/** Handles a batch of conflated market summaries. */
export type MarketSummaryBatchHandler = (
  marketSummaries: readonly MarketSummary[],
) => void | Promise<void>;

/** Configures market-summary conflation. */
export interface MarketSummaryConflatorOptions {
  readonly intervalMs: number;
  readonly onFlush: MarketSummaryBatchHandler;
  readonly onError: (error: unknown) => void;
}

/** Coalesces market summaries by symbol over fixed windows. */
export class MarketSummaryConflator {
  readonly #intervalMs: number;
  readonly #onFlush: MarketSummaryBatchHandler;
  readonly #onError: (error: unknown) => void;
  readonly #pendingBySymbol = new Map<string, MarketSummary>();

  #timer: ReturnType<typeof setTimeout> | undefined;
  #activeFlush: Promise<void> | undefined;
  #closed = false;

  constructor(options: MarketSummaryConflatorOptions) {
    if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
      throw new Error("intervalMs must be greater than zero.");
    }

    this.#intervalMs = options.intervalMs;
    this.#onFlush = options.onFlush;
    this.#onError = options.onError;
  }

  /** Retains the latest summary for a symbol. */
  update(marketSummary: MarketSummary): void {
    if (this.#closed) {
      throw new Error("Cannot update a closed conflator.");
    }

    this.#pendingBySymbol.set(normalizeSymbol(marketSummary.symbol), marketSummary);

    this.#scheduleFlush();
  }

  /** Immediately publishes all currently pending summaries. */
  async flush(): Promise<void> {
    this.#cancelScheduledFlush();

    if (this.#activeFlush !== undefined) {
      await this.#activeFlush;
    }

    if (this.#pendingBySymbol.size === 0) {
      return;
    }

    const marketSummaries = [...this.#pendingBySymbol.values()];

    /**
     * The map is cleared before onFlush runs.
     * New updates arriving during publication go into a fresh window
     */
    this.#pendingBySymbol.clear();

    const activeFlush = Promise.resolve(this.#onFlush(marketSummaries));

    this.#activeFlush = activeFlush;

    try {
      await activeFlush;
    } finally {
      this.#activeFlush = undefined;
    }
  }

  /** Flushes pending summaries and prevents further updates. */
  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    await this.flush();
  }

  #scheduleFlush(): void {
    if (this.#timer !== undefined) {
      return;
    }

    this.#timer = setTimeout(() => {
      this.#timer = undefined;

      void this.flush().catch((error: unknown) => {
        this.#onError(error);
      });
    }, this.#intervalMs);
  }

  #cancelScheduledFlush(): void {
    if (this.#timer === undefined) {
      return;
    }

    clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}
