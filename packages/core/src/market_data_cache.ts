import { z } from "zod";
import {
  barsRequestSchema,
  marketBarSchema,
  marketSummarySchema,
  type BarsRequest,
  type MarketBar,
  type MarketClock,
  type MarketDataRequest,
  type MarketQuote,
  type MarketSummary,
  type MarketTrade,
} from "./market_data.js";
import type { OrderBookSnapshot } from "./order_book.js";
import { createMarketDataRequestKey, normalizeSymbol } from "./symbols.js";

/** Maximum number of market summaries accepted in one cache or pipeline batch. */
export const MAX_MARKET_SUMMARIES_PER_BATCH = 10_000;

/** Validates a symbol-keyed batch of normalized market summaries. */
export const marketSummaryBatchSchema = z
  .record(z.string(), marketSummarySchema)
  .superRefine((marketSummaries, context) => {
    const entries = Object.entries(marketSummaries);

    if (entries.length > MAX_MARKET_SUMMARIES_PER_BATCH) {
      context.addIssue({
        code: "custom",
        message: "A market-summary batch cannot contain more than 10000 entries.",
      });
    }

    const normalizedKeys = new Set<string>();

    for (const [key, marketSummary] of entries) {
      if (key.length === 0 || key.length > 64 || key !== key.trim()) {
        context.addIssue({
          code: "custom",
          path: [key],
          message:
            "Market-summary keys must be non-blank identifiers without surrounding whitespace.",
        });

        continue;
      }

      const normalizedKey = normalizeSymbol(key);

      if (normalizedKey !== normalizeSymbol(marketSummary.symbol)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Market-summary key must identify the same symbol as its value.",
        });
      }

      if (normalizedKeys.has(normalizedKey)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Market-summary batch contains duplicate normalized symbol keys.",
        });
      }

      normalizedKeys.add(normalizedKey);
    }
  });

/** Provider-neutral cache contract for latest market data. */
export interface MarketDataCache {
  /** Stores the latest quote for a symbol. */
  setLatestQuote(quote: MarketQuote): Promise<void>;

  /** Returns the latest quote for a symbol and optional venue when available. */
  getLatestQuote(request: MarketDataRequest): Promise<MarketQuote | undefined>;

  /** Stores the latest trade for a symbol. */
  setLatestTrade(trade: MarketTrade): Promise<void>;

  /** Returns the latest trade for a symbol and optional venue when available. */
  getLatestTrade(request: MarketDataRequest): Promise<MarketTrade | undefined>;

  /** Stores the latest complete snapshot for one order book. */
  setOrderBookSnapshot(snapshot: OrderBookSnapshot): Promise<void>;

  /** Returns the latest complete snapshot when available. */
  getOrderBookSnapshot(request: MarketDataRequest): Promise<OrderBookSnapshot | undefined>;

  /** Stores latest market summaries keyed by symbol. */
  setMarketSummaries(marketSummaries: Readonly<Record<string, MarketSummary>>): Promise<void>;

  /** Returns all currently cached marketSummaries keyed by symbol. */
  getMarketSummaries(): Promise<Readonly<Record<string, MarketSummary>>>;

  /** Stores the latest market summary for one symbol. */
  setMarketSummary(marketSummary: MarketSummary): Promise<void>;

  /** Returns the latest market summary for a symbol. */
  getMarketSummary(symbol: string): Promise<MarketSummary | undefined>;

  /** Stores or replaces a bar identified by symbol, venue, timeframe, and timestamp. */
  appendBar(bar: MarketBar): Promise<void>;

  /**
   * Returns matching bars in chronological order.
   *
   * `start` and `end` are inclusive. When `limit` is supplied, the most recent
   * matching bars are returned.
   */
  getBars(request: BarsRequest): Promise<readonly MarketBar[]>;

  /** Stores the latest market clock. */
  setMarketClock(clock: MarketClock): Promise<void>;

  /** Returns the latest market clock when available. */
  getMarketClock(): Promise<MarketClock | undefined>;
}

/** In-memory cache for tests, examples, and single-process demos. */
export class MemoryMarketDataCache implements MarketDataCache {
  readonly #latestQuotesByKey = new Map<string, MarketQuote>();
  readonly #latestTradesByKey = new Map<string, MarketTrade>();
  readonly #orderBookSnapshotsByKey = new Map<string, OrderBookSnapshot>();
  readonly #marketSummariesBySymbol = new Map<string, MarketSummary>();
  readonly #barsByKey = new Map<string, Map<number, MarketBar>>();
  #marketClock: MarketClock | undefined;

  setLatestQuote(quote: MarketQuote): Promise<void> {
    this.#latestQuotesByKey.set(createEventKey(quote), quote);

    return Promise.resolve();
  }

  getLatestQuote(request: MarketDataRequest): Promise<MarketQuote | undefined> {
    return Promise.resolve(this.#latestQuotesByKey.get(createMarketDataRequestKey(request)));
  }

  setLatestTrade(trade: MarketTrade): Promise<void> {
    this.#latestTradesByKey.set(createEventKey(trade), trade);
    return Promise.resolve();
  }

  getLatestTrade(request: MarketDataRequest): Promise<MarketTrade | undefined> {
    return Promise.resolve(this.#latestTradesByKey.get(createMarketDataRequestKey(request)));
  }

  setOrderBookSnapshot(snapshot: OrderBookSnapshot): Promise<void> {
    const key = createOrderBookKey({
      symbol: snapshot.symbol,
      ...(snapshot.venue === undefined ? {} : { venue: snapshot.venue }),
    });

    this.#orderBookSnapshotsByKey.set(key, snapshot);

    return Promise.resolve();
  }

  getOrderBookSnapshot(request: MarketDataRequest): Promise<OrderBookSnapshot | undefined> {
    return Promise.resolve(this.#orderBookSnapshotsByKey.get(createOrderBookKey(request)));
  }

  setMarketSummaries(marketSummaries: Readonly<Record<string, MarketSummary>>): Promise<void> {
    return Promise.resolve().then(() => {
      const parsedMarketSummaries = marketSummaryBatchSchema.parse(marketSummaries);

      for (const [symbol, marketSummary] of Object.entries(parsedMarketSummaries)) {
        this.#marketSummariesBySymbol.set(normalizeSymbol(symbol), marketSummary);
      }
    });
  }

  getMarketSummaries(): Promise<Readonly<Record<string, MarketSummary>>> {
    return Promise.resolve(Object.fromEntries(this.#marketSummariesBySymbol));
  }

  setMarketSummary(marketSummary: MarketSummary): Promise<void> {
    this.#marketSummariesBySymbol.set(normalizeSymbol(marketSummary.symbol), marketSummary);

    return Promise.resolve();
  }

  getMarketSummary(symbol: string): Promise<MarketSummary | undefined> {
    return Promise.resolve(this.#marketSummariesBySymbol.get(normalizeSymbol(symbol)));
  }

  appendBar(bar: MarketBar): Promise<void> {
    const parsedBar = marketBarSchema.parse(bar);
    const key = createBarsKey(parsedBar);
    const bars = this.#barsByKey.get(key) ?? new Map<number, MarketBar>();

    bars.set(Date.parse(parsedBar.timestamp), parsedBar);
    this.#barsByKey.set(key, bars);

    return Promise.resolve();
  }

  getBars(request: BarsRequest): Promise<readonly MarketBar[]> {
    const parsedRequest = barsRequestSchema.parse(request);
    const bars = this.#barsByKey.get(createBarsKey(parsedRequest));

    if (bars === undefined) {
      return Promise.resolve([]);
    }

    const startTime =
      parsedRequest.start === undefined
        ? Number.NEGATIVE_INFINITY
        : Date.parse(parsedRequest.start);

    const endTime =
      parsedRequest.end === undefined ? Number.POSITIVE_INFINITY : Date.parse(parsedRequest.end);

    const matchingBars = [...bars.entries()]
      .filter(([timestamp]) => timestamp >= startTime && timestamp <= endTime)
      .sort(([leftTimestamp], [rightTimestamp]) => leftTimestamp - rightTimestamp)
      .map(([, bar]) => bar);

    const limitedBars =
      parsedRequest.limit === undefined ? matchingBars : matchingBars.slice(-parsedRequest.limit);

    return Promise.resolve(limitedBars);
  }

  setMarketClock(clock: MarketClock): Promise<void> {
    this.#marketClock = clock;
    return Promise.resolve();
  }

  getMarketClock(): Promise<MarketClock | undefined> {
    return Promise.resolve(this.#marketClock);
  }
}

function createEventKey(event: MarketQuote | MarketTrade): string {
  return createMarketDataRequestKey({
    symbol: event.symbol,
    ...(event.venue === undefined ? {} : { venue: event.venue }),
  });
}

function createOrderBookKey(request: MarketDataRequest): string {
  return createMarketDataRequestKey(request);
}

function createBarsKey(request: BarsRequest): string {
  return JSON.stringify([createMarketDataRequestKey(request), request.timeframe]);
}
