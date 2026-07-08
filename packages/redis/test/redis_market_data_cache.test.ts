import { describe, expect, it } from "vitest";
import { RedisMarketDataCache } from "../src/redis_market_data_cache.js";
import { FakeRedisClient } from "./fake_redis_client.js";
import type { MarketBar, MarketClock, MarketSnapshot, MarketTrade } from "@zagvar/relay-core";

describe("RedisMarketDataCache", () => {
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

  it("stores and returns snapshots with normalized keys", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const snapshots: Record<string, MarketSnapshot> = {
      aapl: {
        symbol: "aapl",
        price: 195.12,
      },
    };

    await cache.setSnapshots(snapshots);

    expect(await cache.getSnapshots()).toEqual({
      AAPL: snapshots.aapl,
    });
  });

  it("expires snapshots when ttl is configured", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({
      client,
      snapshotTtlSeconds: 5,
    });

    await cache.setSnapshots({
      AAPL: {
        symbol: "AAPL",
        price: 195.12,
      },
    });

    client.advanceTime(5_000);

    expect(await cache.getSnapshots()).toEqual({});
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
