import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL } from "../src/event_channel.js";
import { MemoryRelayEventBus } from "../src/event_bus.js";
import { MemoryMarketDataCache } from "../src/market_data_cache.js";
import { MarketDataPipeline } from "../src/market_data_pipeline.js";
import type {
  MarketBar,
  MarketClock,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "../src/market_data.js";
import type { OrderBookSnapshot, OrderBookUpdate } from "../src/order_book.js";

const orderBookSnapshot: OrderBookSnapshot = {
  type: "order_book_snapshot",
  symbol: "BTC/USDT",
  assetClass: "crypto",
  venue: "COINBASE",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  bids: [{ price: 65_000, quantity: 1.25 }],
  asks: [{ price: 65_001, quantity: 0.8 }],
  timestamp: "2026-01-01T14:30:00.000Z",
  sequence: 100,
};

const orderBookUpdate: OrderBookUpdate = {
  type: "order_book_update",
  symbol: "BTC/USDT",
  assetClass: "crypto",
  venue: "COINBASE",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  bids: [{ price: 65_000, quantity: 2 }],
  asks: [{ price: 65_001, quantity: 0 }],
  timestamp: "2026-01-01T14:30:01.000Z",
  sequence: 101,
  previousSequence: 100,
  reset: false,
};

describe("MarketDataPipeline", () => {
  it("stores and publishes trade events", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      publishedMessages.push(message);
    });

    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      assetClass: "equity",
      price: 195.12,
      quantity: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await pipeline.processEvent(trade);

    expect(await cache.getLatestTrade({ symbol: "AAPL" })).toEqual(trade);
    expect(publishedMessages).toEqual([
      {
        channel: "trade",
        data: trade,
      },
    ]);
  });

  it("stores and publishes quote events", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.quote, (message) => {
      publishedMessages.push(message);
    });

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

    await pipeline.processEvent(quote);

    expect(await cache.getLatestQuote({ symbol: "AAPL" })).toEqual(quote);
    expect(publishedMessages).toEqual([
      {
        channel: "quote",
        data: quote,
      },
    ]);
  });

  it("stores and publishes bar events", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.bar, (message) => {
      publishedMessages.push(message);
    });

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

    await pipeline.processEvent(bar);

    expect(await cache.getBars({ symbol: "AAPL", timeframe: "1Min" })).toEqual([bar]);
    expect(publishedMessages).toEqual([
      {
        channel: "bar",
        data: bar,
      },
    ]);
  });

  it("stores and publishes order-book snapshots", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({
      cache,
      eventBus,
    });
    const publishedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.orderBook, (message) => {
      publishedMessages.push(message);
    });

    await pipeline.processEvent(orderBookSnapshot);

    await expect(
      cache.getOrderBookSnapshot({
        symbol: "BTC/USDT",
        venue: "COINBASE",
      }),
    ).resolves.toEqual(orderBookSnapshot);

    expect(publishedMessages).toEqual([
      {
        channel: "order_book",
        data: orderBookSnapshot,
      },
    ]);
  });

  it("reconciles, stores, and publishes order-book updates", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({
      cache,
      eventBus,
    });
    const publishedMessages: unknown[] = [];

    await pipeline.processEvent(orderBookSnapshot);

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.orderBook, (message) => {
      publishedMessages.push(message);
    });

    await pipeline.processEvent(orderBookUpdate);

    await expect(
      cache.getOrderBookSnapshot({
        symbol: "BTC/USDT",
        venue: "COINBASE",
      }),
    ).resolves.toEqual({
      ...orderBookSnapshot,
      bids: [{ price: 65_000, quantity: 2 }],
      asks: [],
      timestamp: "2026-01-01T14:30:01.000Z",
      sequence: 101,
    });

    expect(publishedMessages).toEqual([
      {
        channel: "order_book",
        data: orderBookUpdate,
      },
    ]);
  });

  it("rejects an update when no snapshot is cached", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({
      cache,
      eventBus,
    });

    await expect(pipeline.processEvent(orderBookUpdate)).rejects.toMatchObject({
      name: "OrderBookPipelineError",
      code: "snapshot_missing",
    });
  });

  it("rejects sequence gaps without changing the cached book", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({
      cache,
      eventBus,
    });

    await pipeline.processEvent(orderBookSnapshot);

    await expect(
      pipeline.processEvent({
        ...orderBookUpdate,
        previousSequence: 99,
      }),
    ).rejects.toMatchObject({
      name: "OrderBookPipelineError",
      code: "sequence_gap",
    });

    await expect(
      cache.getOrderBookSnapshot({
        symbol: "BTC/USDT",
        venue: "COINBASE",
      }),
    ).resolves.toEqual(orderBookSnapshot);
  });

  it("stores and publishes market summaries", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.marketSummary, (message) => {
      publishedMessages.push(message);
    });

    const marketSummaries: Record<string, MarketSummary> = {
      AAPL: {
        symbol: "AAPL",
        assetClass: "equity",
        price: 195.12,
        previousClose: 190,
      },
    };

    await pipeline.processMarketSummaries(marketSummaries);

    expect(await cache.getMarketSummaries()).toEqual(marketSummaries);
    expect(publishedMessages).toEqual([
      {
        channel: "market_summary",
        data: marketSummaries.AAPL,
      },
    ]);
  });

  it("stores and publishes one market summary", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];
    const marketSummary: MarketSummary = {
      symbol: "AAPL",
      assetClass: "equity",
      price: 195.12,
      previousClose: 190,
    };

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.marketSummary, (message) => {
      publishedMessages.push(message);
    });

    await pipeline.processMarketSummary(marketSummary);

    await expect(cache.getMarketSummary("aapl")).resolves.toEqual(marketSummary);

    expect(publishedMessages).toEqual([
      {
        channel: "market_summary",
        data: marketSummary,
      },
    ]);
  });

  it("stores and publishes market clock", async () => {
    const cache = new MemoryMarketDataCache();
    const eventBus = new MemoryRelayEventBus();
    const pipeline = new MarketDataPipeline({ cache, eventBus });
    const publishedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.marketClock, (message) => {
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
