import type { MarketBar, MarketClock, MarketSnapshot, MarketTrade } from "./market_data.js";

/** Provider-neutral cache contract for latest market data. */
export interface MarketDataCache {
  /** Stores the latest trade for a symbol. */
  setLatestTrade(trade: MarketTrade): Promise<void>;

  /** Returns the latest trade for a symbol when available. */
  getLatestTrade(symbol: string): Promise<MarketTrade | undefined>;

  /** Stores latest snapshots keyed by symbol. */
  setSnapshots(snapshots: Readonly<Record<string, MarketSnapshot>>): Promise<void>;

  /** Returns all currently cached snapshots keyed by symbol. */
  getSnapshots(): Promise<Readonly<Record<string, MarketSnapshot>>>;

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
  #snapshots: Readonly<Record<string, MarketSnapshot>> = {};
  readonly #barsByKey = new Map<string, MarketBar[]>();
  #marketClock: MarketClock | undefined;

  setLatestTrade(trade: MarketTrade): Promise<void> {
    this.#latestTradesBySymbol.set(trade.symbol, trade);
    return Promise.resolve();
  }

  getLatestTrade(symbol: string): Promise<MarketTrade | undefined> {
    return Promise.resolve(this.#latestTradesBySymbol.get(symbol));
  }

  setSnapshots(snapshots: Readonly<Record<string, MarketSnapshot>>): Promise<void> {
    this.#snapshots = { ...snapshots };
    return Promise.resolve();
  }

  getSnapshots(): Promise<Readonly<Record<string, MarketSnapshot>>> {
    return Promise.resolve(this.#snapshots);
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
  return `${symbol}:${timeframe}`;
}
