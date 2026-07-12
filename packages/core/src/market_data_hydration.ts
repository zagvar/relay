import { normalizeSymbol } from "./symbols.js";
import type { MarketDataCache } from "./market_data_cache.js";
import type {
  BarsRequest,
  MarketBar,
  MarketClock,
  MarketDataRequest,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "./market_data.js";
import type { OrderBookSnapshot } from "./order_book.js";

/** Request for cached market data suitable for initial client hydration. */
export interface MarketDataHydrationRequest {
  readonly symbols?: readonly string[];
  readonly quotes?: readonly MarketDataRequest[];
  readonly trades?: readonly MarketDataRequest[];
  readonly bars?: readonly BarsRequest[];
  readonly orderBooks?: readonly MarketDataRequest[];
  readonly includeMarketSummaries?: boolean;
  readonly includeMarketClock?: boolean;
}

/** Request for cached bars in a hydration response. */
export type BarsHydrationRequest = BarsRequest;

/** Cached market data returned for initial client hydration. */
export interface MarketDataHydration {
  readonly marketSummaries?: Readonly<Record<string, MarketSummary>>;
  readonly latestQuotes?: readonly MarketQuote[];
  readonly latestTrades?: readonly MarketTrade[];
  readonly bars?: readonly MarketBar[];
  readonly orderBookSnapshots?: readonly OrderBookSnapshot[];
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
      marketSummaries?: Readonly<Record<string, MarketSummary>>;
      latestQuotes?: readonly MarketQuote[];
      latestTrades?: readonly MarketTrade[];
      bars?: readonly MarketBar[];
      orderBookSnapshots?: readonly OrderBookSnapshot[];
      marketClock?: MarketClock;
    } = {};

    const symbols = request.symbols?.map(normalizeSymbol) ?? [];

    if (request.includeMarketSummaries === true) {
      hydration.marketSummaries = await this.#hydrateMarketSummaries(symbols);
    }

    if (request.quotes !== undefined) {
      hydration.latestQuotes = await this.#hydrateLatestQuotes(request.quotes);
    }

    if (request.trades !== undefined) {
      hydration.latestTrades = await this.#hydrateLatestTrades(request.trades);
    }

    if (request.bars !== undefined) {
      hydration.bars = await this.#hydrateBars(request.bars);
    }

    if (request.orderBooks !== undefined) {
      hydration.orderBookSnapshots = await this.#hydrateOrderBooks(request.orderBooks);
    }

    if (request.includeMarketClock === true) {
      const marketClock = await this.#cache.getMarketClock();

      if (marketClock !== undefined) {
        hydration.marketClock = marketClock;
      }
    }

    return hydration;
  }

  async #hydrateMarketSummaries(
    symbols: readonly string[],
  ): Promise<Readonly<Record<string, MarketSummary>>> {
    const marketSummaries = await this.#cache.getMarketSummaries();

    if (symbols.length === 0) {
      return marketSummaries;
    }

    return Object.fromEntries(
      symbols.flatMap((symbol) => {
        const marketSummary = marketSummaries[symbol];

        return marketSummary === undefined ? [] : [[symbol, marketSummary]];
      }),
    );
  }

  async #hydrateLatestQuotes(
    requests: readonly MarketDataRequest[],
  ): Promise<readonly MarketQuote[]> {
    const quotes = await Promise.all(
      requests.map(async (request) => this.#cache.getLatestQuote(request)),
    );

    return quotes.filter((quote): quote is MarketQuote => quote !== undefined);
  }

  async #hydrateLatestTrades(
    requests: readonly MarketDataRequest[],
  ): Promise<readonly MarketTrade[]> {
    const trades = await Promise.all(
      requests.map(async (request) => this.#cache.getLatestTrade(request)),
    );

    return trades.filter((trade): trade is MarketTrade => trade !== undefined);
  }

  async #hydrateBars(requests: readonly BarsRequest[]): Promise<readonly MarketBar[]> {
    const barGroups = await Promise.all(
      requests.map(async (request) => this.#cache.getBars(request)),
    );

    return barGroups.flat();
  }

  async #hydrateOrderBooks(
    requests: readonly MarketDataRequest[],
  ): Promise<readonly OrderBookSnapshot[]> {
    const snapshots = await Promise.all(
      requests.map(async (request) => this.#cache.getOrderBookSnapshot(request)),
    );

    return snapshots.filter((snapshot): snapshot is OrderBookSnapshot => snapshot !== undefined);
  }
}
