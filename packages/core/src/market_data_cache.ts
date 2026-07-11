import type {
  BarsRequest,
  MarketBar,
  MarketClock,
  MarketDataRequest,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "./market_data.js";
import type { OrderBookRequest, OrderBookSnapshot } from "./order_book.js";
import { createMarketDataRequestKey, normalizeSymbol } from "./symbols.js";

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
  getOrderBookSnapshot(request: OrderBookRequest): Promise<OrderBookSnapshot | undefined>;

  /** Stores latest market summaries keyed by symbol. */
  setMarketSummaries(marketSummaries: Readonly<Record<string, MarketSummary>>): Promise<void>;

  /** Returns all currently cached marketSummaries keyed by symbol. */
  getMarketSummaries(): Promise<Readonly<Record<string, MarketSummary>>>;

  /** Stores the latest market summary for one symbol. */
  setMarketSummary(marketSummary: MarketSummary): Promise<void>;

  /** Returns the latest market summary for a symbol. */
  getMarketSummary(symbol: string): Promise<MarketSummary | undefined>;

  /** Appends a bar to the cached time series for its symbol and timeframe. */
  appendBar(bar: MarketBar): Promise<void>;

  /** Returns cached bars for a symbol, venue, and timeframe. */
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
  readonly #barsByKey = new Map<string, MarketBar[]>();
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

  getOrderBookSnapshot(request: OrderBookRequest): Promise<OrderBookSnapshot | undefined> {
    return Promise.resolve(this.#orderBookSnapshotsByKey.get(createOrderBookKey(request)));
  }

  setMarketSummaries(marketSummaries: Readonly<Record<string, MarketSummary>>): Promise<void> {
    for (const [symbol, marketSummary] of Object.entries(marketSummaries)) {
      this.#marketSummariesBySymbol.set(normalizeSymbol(symbol), marketSummary);
    }

    return Promise.resolve();
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
    const key = createBarsKey(bar);
    const bars = this.#barsByKey.get(key) ?? [];

    bars.push(bar);
    this.#barsByKey.set(key, bars);

    return Promise.resolve();
  }

  getBars(request: BarsRequest): Promise<readonly MarketBar[]> {
    return Promise.resolve(this.#barsByKey.get(createBarsKey(request)) ?? []);
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

function createOrderBookKey(request: OrderBookRequest): string {
  return createMarketDataRequestKey(request);
}

function createBarsKey(request: BarsRequest): string {
  return JSON.stringify([
    createMarketDataRequestKey(request),
    request.timeframe,
  ]);
}
