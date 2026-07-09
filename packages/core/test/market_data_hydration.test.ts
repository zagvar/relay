import { describe, expect, it } from "vitest";
import { MemoryMarketDataCache } from "../src/market_data_cache.js";
import { MarketDataHydrator } from "../src/market_data_hydration.js";
import type { MarketBar, MarketClock, MarketSummary, MarketTrade } from "../src/market_data.js";

describe("MarketDataHydrator", () => {
  it("hydrates marketSummaries for selected symbols", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const marketSummaries: Record<string, MarketSummary> = {
      AAPL: { symbol: "AAPL", price: 195.12 },
      MSFT: { symbol: "MSFT", price: 420.5 },
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

  it("hydrates latest trades for selected symbols", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      price: 195.12,
      size: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestTrade(trade);

    await expect(
      hydrator.hydrate({
        symbols: ["aapl", "msft"],
        includeLatestTrades: true,
      }),
    ).resolves.toEqual({
      latestTrades: {
        AAPL: trade,
      },
    });
  });

  it("hydrates bars by symbol and timeframe", async () => {
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const bar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
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
      bars: {
        "AAPL:1Min": [bar],
      },
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
