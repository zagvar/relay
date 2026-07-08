import { normalizeSymbol } from "./symbols.js";
import type { MarketDataCache } from "./market_data_cache.js";
import type { MarketBar, MarketClock, MarketSnapshot, MarketTrade } from "./market_data.js";

/** Request for cached market data suitable for initial client hydration. */
export interface MarketDataHydrationRequest {
  readonly symbols?: readonly string[];
  readonly bars?: readonly BarsHydrationRequest[];
  readonly includeSnapshots?: boolean;
  readonly includeLatestTrades?: boolean;
  readonly includeMarketClock?: boolean;
}

/** Request for cached bars in a hydration response. */
export interface BarsHydrationRequest {
  readonly symbol: string;
  readonly timeframe: string;
}

/** Cached market data returned for initial client hydration. */
export interface MarketDataHydration {
  readonly snapshots?: Readonly<Record<string, MarketSnapshot>>;
  readonly latestTrades?: Readonly<Record<string, MarketTrade>>;
  readonly bars?: Readonly<Record<string, readonly MarketBar[]>>;
  readonly marketClock?: MarketClock;
}

/** Reads cached market data for initial client hydration. */
export class MarketDataHydrator {
  readonly #cache: MarketDataCache;

  constructor(cache: MarketDataCache) {
    this.#cache = cache;
  }

  /** Returns a hydration payload from the configured cache. */
  async hydrate(request: MarketDataHydrationRequest): Promise<MarketDataHydration> {
    const hydration: {
      snapshots?: Readonly<Record<string, MarketSnapshot>>;
      latestTrades?: Readonly<Record<string, MarketTrade>>;
      bars?: Readonly<Record<string, readonly MarketBar[]>>;
      marketClock?: MarketClock;
    } = {};

    const symbols = request.symbols?.map(normalizeSymbol) ?? [];

    if (request.includeSnapshots === true) {
      hydration.snapshots = await this.#hydrateSnapshots(symbols);
    }

    if (request.includeLatestTrades === true) {
      hydration.latestTrades = await this.#hydrateLatestTrades(symbols);
    }

    if (request.bars !== undefined) {
      hydration.bars = await this.#hydrateBars(request.bars);
    }

    if (request.includeMarketClock === true) {
      const marketClock = await this.#cache.getMarketClock();

      if (marketClock !== undefined) {
        hydration.marketClock = marketClock;
      }
    }

    return hydration;
  }

  async #hydrateSnapshots(
    symbols: readonly string[],
  ): Promise<Readonly<Record<string, MarketSnapshot>>> {
    const snapshots = await this.#cache.getSnapshots();

    if (symbols.length === 0) {
      return snapshots;
    }

    return Object.fromEntries(
      symbols.flatMap((symbol) => {
        const snapshot = snapshots[symbol];

        return snapshot === undefined ? [] : [[symbol, snapshot]];
      }),
    );
  }

  async #hydrateLatestTrades(
    symbols: readonly string[],
  ): Promise<Readonly<Record<string, MarketTrade>>> {
    const trades = await Promise.all(
      symbols.map(async (symbol) => [symbol, await this.#cache.getLatestTrade(symbol)] as const),
    );

    return Object.fromEntries(
      trades.flatMap(([symbol, trade]) => (trade === undefined ? [] : [[symbol, trade]])),
    );
  }

  async #hydrateBars(
    requests: readonly BarsHydrationRequest[],
  ): Promise<Readonly<Record<string, readonly MarketBar[]>>> {
    const bars = await Promise.all(
      requests.map(async (request) => {
        const symbol = normalizeSymbol(request.symbol);
        const key = createBarsHydrationKey(symbol, request.timeframe);

        return [key, await this.#cache.getBars(symbol, request.timeframe)] as const;
      }),
    );

    return Object.fromEntries(bars);
  }
}

function createBarsHydrationKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}
