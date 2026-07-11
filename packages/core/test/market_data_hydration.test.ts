import { describe, expect, it } from "vitest";
import { MemoryMarketDataCache } from "../src/market_data_cache.js";
import { MarketDataHydrator } from "../src/market_data_hydration.js";
import type {
  MarketBar,
  MarketClock,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "../src/market_data.js";
import type { OrderBookSnapshot } from "../src/order_book.js";

describe("MarketDataHydrator", () => {
  it("hydrates marketSummaries for selected symbols", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const marketSummaries: Record<string, MarketSummary> = {
      AAPL: { symbol: "AAPL", assetClass: "equity", price: 195.12 },
      MSFT: { symbol: "MSFT", assetClass: "equity", price: 420.5 },
    };

    await cache.setMarketSummaries(marketSummaries);

    await expect(
      hydrator.hydrate({
        symbols: ["aapl"],
        includeMarketSummaries: true,
      }),
    ).resolves.toEqual({
      marketSummaries: {
        AAPL: marketSummaries.AAPL,
      },
    });
  });

  it("hydrates latest quotes for selected symbols", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const quote: MarketQuote = {
      type: "quote",
      symbol: "AAPL",
      assetClass: "equity",
      bidPrice: 195.1,
      bidQuantity: 200,
      askPrice: 195.12,
      askQuantity: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestQuote(quote);

    await expect(
      hydrator.hydrate({
        quotes: [{ symbol: "aapl" }],
      }),
    ).resolves.toEqual({
      latestQuotes: [quote],
    });
  });

  it("hydrates latest trades for selected symbols", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      assetClass: "equity",
      price: 195.12,
      quantity: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestTrade(trade);

    await expect(
      hydrator.hydrate({
        trades: [{ symbol: "aapl" }, { symbol: "msft" }],
      }),
    ).resolves.toEqual({
      latestTrades: [trade],
    });
  });

  it("hydrates bars by symbol and timeframe", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const bar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: 190,
      high: 196,
      low: 189,
      close: 195,
      volume: 120_000,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.appendBar(bar);

    await expect(
      hydrator.hydrate({
        bars: [{ symbol: "aapl", timeframe: "1Min" }],
      }),
    ).resolves.toEqual({
      bars: [bar],
    });
  });

  it("hydrates available venue-specific order books", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const snapshot: OrderBookSnapshot = {
      type: "order_book_snapshot",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: [{ price: 65_000, quantity: 1.25 }],
      asks: [{ price: 65_000.5, quantity: 0.8 }],
      timestamp: "2026-01-01T14:30:00.000Z",
      sequence: 100,
    };

    await cache.setOrderBookSnapshot(snapshot);

    await expect(
      hydrator.hydrate({
        orderBooks: [
          {
            symbol: "btc/usdt",
            venue: "coinbase",
          },
          {
            symbol: "ETH/USDT",
            venue: "COINBASE",
          },
        ],
      }),
    ).resolves.toEqual({
      orderBookSnapshots: [snapshot],
    });
  });

  it("returns an empty order-book list when none are requested", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);

    await expect(
      hydrator.hydrate({
        orderBooks: [],
      }),
    ).resolves.toEqual({
      orderBookSnapshots: [],
    });
  });

  it("hydrates market clock when available", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const clock: MarketClock = {
      isOpen: true,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setMarketClock(clock);

    await expect(
      hydrator.hydrate({
        includeMarketClock: true,
      }),
    ).resolves.toEqual({
      marketClock: clock,
    });
  });
});
