import type {
  MarketBar,
  MarketClock,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "./market_data.js";
import { normalizeSymbol } from "./symbols.js";

/** Provider-neutral cache contract for latest market data. */
export interface MarketDataCache {
  /** Stores the latest quote for a symbol. */
  setLatestQuote(quote: MarketQuote): Promise<void>;

  /** Returns the latest quote for a symbol when available. */
  getLatestQuote(symbol: string): Promise<MarketQuote | undefined>;

  /** Stores the latest trade for a symbol. */
  setLatestTrade(trade: MarketTrade): Promise<void>;

  /** Returns the latest trade for a symbol when available. */
  getLatestTrade(symbol: string): Promise<MarketTrade | undefined>;

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

  /** Returns cached bars for a symbol and timeframe. */
  getBars(symbol: string, timeframe: string): Promise<readonly MarketBar[]>;

  /** Stores the latest market clock. */
  setMarketClock(clock: MarketClock): Promise<void>;

  /** Returns the latest market clock when available. */
  getMarketClock(): Promise<MarketClock | undefined>;
}

/** In-memory cache for tests, examples, and single-process demos. */
export class MemoryMarketDataCache implements MarketDataCache {
  readonly #latestQuotesBySymbol = new Map<string, MarketQuote>();
  readonly #latestTradesBySymbol = new Map<string, MarketTrade>();
  readonly #marketSummariesBySymbol = new Map<string, MarketSummary>();
  readonly #barsByKey = new Map<string, MarketBar[]>();
  #marketClock: MarketClock | undefined;

  setLatestQuote(quote: MarketQuote): Promise<void> {
    this.#latestQuotesBySymbol.set(normalizeSymbol(quote.symbol), quote);

    return Promise.resolve();
  }

  getLatestQuote(symbol: string): Promise<MarketQuote | undefined> {
    return Promise.resolve(this.#latestQuotesBySymbol.get(normalizeSymbol(symbol)));
  }

  setLatestTrade(trade: MarketTrade): Promise<void> {
    this.#latestTradesBySymbol.set(normalizeSymbol(trade.symbol), trade);
    return Promise.resolve();
  }

  getLatestTrade(symbol: string): Promise<MarketTrade | undefined> {
    return Promise.resolve(this.#latestTradesBySymbol.get(normalizeSymbol(symbol)));
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
    const key = createBarsKey(bar.symbol, bar.timeframe);
    const bars = this.#barsByKey.get(key) ?? [];

    bars.push(bar);
    this.#barsByKey.set(key, bars);

    return Promise.resolve();
  }

  getBars(symbol: string, timeframe: string): Promise<readonly MarketBar[]> {
    return Promise.resolve(this.#barsByKey.get(createBarsKey(symbol, timeframe)) ?? []);
  }

  setMarketClock(clock: MarketClock): Promise<void> {
    this.#marketClock = clock;
    return Promise.resolve();
  }

  getMarketClock(): Promise<MarketClock | undefined> {
    return Promise.resolve(this.#marketClock);
  }
}

function createBarsKey(symbol: string, timeframe: string): string {
  return `${normalizeSymbol(symbol)}:${timeframe}`;
}
