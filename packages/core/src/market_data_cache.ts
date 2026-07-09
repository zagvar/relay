import type { MarketBar, MarketClock, MarketSummary, MarketTrade } from "./market_data.js";
import { normalizeSymbol } from "./symbols.js";

/** Provider-neutral cache contract for latest market data. */
export interface MarketDataCache {
  /** Stores the latest trade for a symbol. */
  setLatestTrade(trade: MarketTrade): Promise<void>;

  /** Returns the latest trade for a symbol when available. */
  getLatestTrade(symbol: string): Promise<MarketTrade | undefined>;

  /** Stores latest market summaries keyed by symbol. */
  setMarketSummaries(marketSummaries: Readonly<Record<string, MarketSummary>>): Promise<void>;

  /** Returns all currently cached marketSummaries keyed by symbol. */
  getMarketSummaries(): Promise<Readonly<Record<string, MarketSummary>>>;

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
  readonly #latestTradesBySymbol = new Map<string, MarketTrade>();
  #marketSummaries: Readonly<Record<string, MarketSummary>> = {};
  readonly #barsByKey = new Map<string, MarketBar[]>();
  #marketClock: MarketClock | undefined;

  setLatestTrade(trade: MarketTrade): Promise<void> {
    this.#latestTradesBySymbol.set(normalizeSymbol(trade.symbol), trade);
    return Promise.resolve();
  }

  getLatestTrade(symbol: string): Promise<MarketTrade | undefined> {
    return Promise.resolve(this.#latestTradesBySymbol.get(normalizeSymbol(symbol)));
  }

  setMarketSummaries(marketSummaries: Readonly<Record<string, MarketSummary>>): Promise<void> {
    this.#marketSummaries = Object.fromEntries(
      Object.entries(marketSummaries).map(([symbol, snapshot]) => [
        normalizeSymbol(symbol),
        snapshot,
      ]),
    );
    return Promise.resolve();
  }

  getMarketSummaries(): Promise<Readonly<Record<string, MarketSummary>>> {
    return Promise.resolve(this.#marketSummaries);
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
