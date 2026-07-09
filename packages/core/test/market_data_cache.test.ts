import { describe, expect, it } from "vitest";
import { MemoryMarketDataCache } from "../src/market_data_cache.js";
import type { MarketBar, MarketClock, MarketSummary, MarketTrade } from "../src/market_data.js";

describe("MemoryMarketDataCache", () => {
  it("stores and returns latest trades", async () => {
    const cache = new MemoryMarketDataCache();
    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      price: 195.12,
      size: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestTrade(trade);

    expect(await cache.getLatestTrade("AAPL")).toEqual(trade);
  });

  it("stores and returns marketSummaries", async () => {
    const cache = new MemoryMarketDataCache();
    const marketSummaries: Record<string, MarketSummary> = {
      AAPL: {
        symbol: "AAPL",
        price: 195.12,
        previousClose: 190,
      },
    };

    await cache.setMarketSummaries(marketSummaries);

    expect(await cache.getMarketSummaries()).toEqual(marketSummaries);
  });

  it("appends and returns bars by symbol and timeframe", async () => {
    const cache = new MemoryMarketDataCache();
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

    expect(await cache.getBars("AAPL", "1Min")).toEqual([bar]);
    expect(await cache.getBars("AAPL", "5Min")).toEqual([]);
  });

  it("stores and returns market clock", async () => {
    const cache = new MemoryMarketDataCache();
    const clock: MarketClock = {
      isOpen: true,
      timestamp: "2026-01-01T14:30:00.000Z",
      nextClose: "2026-01-01T21:00:00.000Z",
    };

    await cache.setMarketClock(clock);

    expect(await cache.getMarketClock()).toEqual(clock);
  });

  it("normalizes latest trade lookup symbols", async () => {
    const cache = new MemoryMarketDataCache();
    const trade: MarketTrade = {
      type: "trade",
      symbol: "aapl",
      price: 195.12,
      size: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestTrade(trade);

    expect(await cache.getLatestTrade("AAPL")).toEqual(trade);
  });

  it("normalizes bar lookup symbols", async () => {
    const cache = new MemoryMarketDataCache();
    const bar: MarketBar = {
      type: "bar",
      symbol: "aapl",
      timeframe: "1Min",
      open: 190,
      high: 196,
      low: 189,
      close: 195,
      volume: 120_000,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.appendBar(bar);

    expect(await cache.getBars("AAPL", "1Min")).toEqual([bar]);
  });
});
