import { describe, expect, it } from "vitest";
import { RedisMarketDataCache } from "../src/redis_market_data_cache.js";
import { FakeRedisClient } from "./fake_redis_client.js";
import type {
  MarketBar,
  MarketClock,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "@zagvar/relay-core";

describe("RedisMarketDataCache", () => {
  it("stores and returns latest quotes", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const quote: MarketQuote = {
      type: "quote",
      symbol: "AAPL",
      bidPrice: 195.1,
      bidSize: 200,
      askPrice: 195.12,
      askSize: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestQuote(quote);

    await expect(cache.getLatestQuote("aapl")).resolves.toEqual(quote);
  });

  it("stores and returns latest trades", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
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

  it("stores and returns one market summary", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const marketSummary: MarketSummary = {
      symbol: "AAPL",
      price: 195.12,
    };

    await cache.setMarketSummary(marketSummary);

    await expect(cache.getMarketSummary("aapl")).resolves.toEqual(marketSummary);
  });

  it("stores and returns marketSummaries with normalized keys", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const marketSummaries: Record<string, MarketSummary> = {
      aapl: {
        symbol: "aapl",
        price: 195.12,
      },
    };

    await cache.setMarketSummaries(marketSummaries);

    expect(await cache.getMarketSummaries()).toEqual({
      AAPL: marketSummaries.aapl,
    });
  });

  it("expires marketSummaries when ttl is configured", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({
      client,
      marketSummaryTtlSeconds: 5,
    });

    await cache.setMarketSummaries({
      AAPL: {
        symbol: "AAPL",
        price: 195.12,
      },
    });

    client.advanceTime(5_000);

    expect(await cache.getMarketSummaries()).toEqual({});
  });

  it("appends and returns bars ordered by timestamp", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const firstBar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      timeframe: "1Min",
      open: 190,
      high: 196,
      low: 189,
      close: 195,
      volume: 120_000,
      timestamp: "2026-01-01T14:31:00.000Z",
    };
    const secondBar: MarketBar = {
      ...firstBar,
      close: 194,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);

    expect(await cache.getBars("aapl", "1Min")).toEqual([secondBar, firstBar]);
  });

  it("stores and returns market clock", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const clock: MarketClock = {
      isOpen: true,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setMarketClock(clock);

    expect(await cache.getMarketClock()).toEqual(clock);
  });

  it("expires market clock when ttl is configured", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({
      client,
      marketClockTtlSeconds: 5,
    });

    await cache.setMarketClock({
      isOpen: true,
      timestamp: "2026-01-01T14:30:00.000Z",
    });

    client.advanceTime(5_000);

    expect(await cache.getMarketClock()).toBeUndefined();
  });

  it("trims bars using timeframe-specific maxBars", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({
      client,
      barRetention: {
        byTimeframe: {
          "1Min": { maxBars: 2 },
        },
      },
    });

    const createBar = (timestamp: string): MarketBar => ({
      type: "bar",
      symbol: "AAPL",
      timeframe: "1Min",
      open: 190,
      high: 196,
      low: 189,
      close: 195,
      volume: 120_000,
      timestamp,
    });

    const firstBar = createBar("2026-01-01T14:30:00.000Z");
    const secondBar = createBar("2026-01-01T14:31:00.000Z");
    const thirdBar = createBar("2026-01-01T14:32:00.000Z");

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);
    await cache.appendBar(thirdBar);

    expect(await cache.getBars("AAPL", "1Min")).toEqual([secondBar, thirdBar]);
  });

  it("expires bars using timeframe-specific ttl", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({
      client,
      barRetention: {
        byTimeframe: {
          "1Min": { ttlSeconds: 5 },
        },
      },
    });

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

    client.advanceTime(5_000);

    expect(await cache.getBars("AAPL", "1Min")).toEqual([]);
  });

  it("uses default bar retention when timeframe override is missing", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({
      client,
      barRetention: {
        default: { maxBars: 1 },
      },
    });

    const firstBar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      timeframe: "5Min",
      open: 190,
      high: 196,
      low: 189,
      close: 195,
      volume: 120_000,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    const secondBar: MarketBar = {
      ...firstBar,
      timestamp: "2026-01-01T14:35:00.000Z",
    };

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);

    expect(await cache.getBars("AAPL", "5Min")).toEqual([secondBar]);
  });
});
