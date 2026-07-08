import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL } from "../src/event_channel.js";
import { MemoryRelayEventBus } from "../src/event_bus.js";
import { MemoryMarketDataCache } from "../src/market_data_cache.js";
import { MarketDataPipeline } from "../src/market_data_pipeline.js";
import type { MarketBar, MarketClock, MarketSnapshot, MarketTrade } from "../src/market_data.js";

describe("MarketDataPipeline", () => {
  it("stores and publishes trade events", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      publishedMessages.push(message);
    });

    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      price: 195.12,
      size: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await pipeline.processEvent(trade);

    expect(await cache.getLatestTrade("AAPL")).toEqual(trade);
    expect(publishedMessages).toEqual([
      {
        channel: "trade",
        data: trade,
      },
    ]);
  });

  it("stores and publishes bar events", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    eventBus.subscribe(MARKET_EVENT_CHANNEL.bar, (message) => {
      publishedMessages.push(message);
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

    await pipeline.processEvent(bar);

    expect(await cache.getBars("AAPL", "1Min")).toEqual([bar]);
    expect(publishedMessages).toEqual([
      {
        channel: "bar",
        data: bar,
      },
    ]);
  });

  it("stores and publishes snapshots", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    eventBus.subscribe(MARKET_EVENT_CHANNEL.snapshot, (message) => {
      publishedMessages.push(message);
    });

    const snapshots: Record<string, MarketSnapshot> = {
      AAPL: {
        symbol: "AAPL",
        price: 195.12,
        previousClose: 190,
      },
    };

    await pipeline.processSnapshots(snapshots);

    expect(await cache.getSnapshots()).toEqual(snapshots);
    expect(publishedMessages).toEqual([
      {
        channel: "snapshot",
        data: snapshots,
      },
    ]);
  });

  it("stores and publishes market clock", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    eventBus.subscribe(MARKET_EVENT_CHANNEL.marketClock, (message) => {
      publishedMessages.push(message);
    });

    const clock: MarketClock = {
      isOpen: true,
      timestamp: "2026-01-01T14:30:00.000Z",
      nextClose: "2026-01-01T21:00:00.000Z",
    };

    await pipeline.processMarketClock(clock);

    expect(await cache.getMarketClock()).toEqual(clock);
    expect(publishedMessages).toEqual([
      {
        channel: "market_clock",
        data: clock,
      },
    ]);
  });
});
