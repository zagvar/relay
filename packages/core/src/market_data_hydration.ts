import { z } from "zod";
import { normalizeSymbol } from "./symbols.js";
import type { MarketDataCache } from "./market_data_cache.js";
import {
  barsRequestSchema,
  marketDataRequestSchema,
  marketIdentifierSchema,
  type BarsRequest,
  type MarketBar,
  type MarketClock,
  type MarketDataRequest,
  type MarketQuote,
  type MarketSummary,
  type MarketTrade,
} from "./market_data.js";
import type { OrderBookSnapshot } from "./order_book.js";

/** Runtime schema for a cached market-data hydration request. */
export const marketDataHydrationRequestSchema = z
  .object({
    symbols: z.array(marketIdentifierSchema).readonly().optional(),
    quotes: z.array(marketDataRequestSchema).readonly().optional(),
    trades: z.array(marketDataRequestSchema).readonly().optional(),
    bars: z.array(barsRequestSchema).readonly().optional(),
    orderBooks: z.array(marketDataRequestSchema).readonly().optional(),
    includeMarketSummaries: z.boolean().optional(),
    includeMarketClock: z.boolean().optional(),
  })
  .strict();

/** Request for cached market data suitable for initial client hydration. */
export type MarketDataHydrationRequest = Readonly<z.infer<typeof marketDataHydrationRequestSchema>>;

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
    const parsedRequest = marketDataHydrationRequestSchema.parse(request);

    const hydration: {
      marketSummaries?: Readonly<Record<string, MarketSummary>>;
      latestQuotes?: readonly MarketQuote[];
      latestTrades?: readonly MarketTrade[];
      bars?: readonly MarketBar[];
      orderBookSnapshots?: readonly OrderBookSnapshot[];
      marketClock?: MarketClock;
    } = {};

    const symbols = parsedRequest.symbols?.map(normalizeSymbol) ?? [];

    if (parsedRequest.includeMarketSummaries === true) {
      hydration.marketSummaries = await this.#hydrateMarketSummaries(symbols);
    }

    if (parsedRequest.quotes !== undefined) {
      hydration.latestQuotes = await this.#hydrateLatestQuotes(parsedRequest.quotes);
    }

    if (parsedRequest.trades !== undefined) {
      hydration.latestTrades = await this.#hydrateLatestTrades(parsedRequest.trades);
    }

    if (parsedRequest.bars !== undefined) {
      hydration.bars = await this.#hydrateBars(parsedRequest.bars);
    }

    if (parsedRequest.orderBooks !== undefined) {
      hydration.orderBookSnapshots = await this.#hydrateOrderBooks(parsedRequest.orderBooks);
    }

    if (parsedRequest.includeMarketClock === true) {
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
