import { describe, expect, it } from "vitest";
import { MemoryMarketDataCache } from "../src/market_data_cache.js";
import type {
  MarketBar,
  MarketClock,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "../src/market_data.js";
import type { OrderBookSnapshot } from "../src/order_book.js";

describe("MemoryMarketDataCache", () => {
  it("stores and returns latest quotes", async () => {
    const cache = new MemoryMarketDataCache();
    const quote: MarketQuote = {
      type: "quote",
      symbol: "AAPL",
      assetClass: "equity",
      bidPrice: "195.1",
      bidQuantity: "200",
      askPrice: "195.12",
      askQuantity: "100",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestQuote(quote);

    expect(await cache.getLatestQuote({ symbol: "aapl" })).toEqual(quote);
  });

  it("stores and returns latest trades", async () => {
    const cache = new MemoryMarketDataCache();
    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      assetClass: "equity",
      price: "195.12",
      quantity: "100",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestTrade(trade);

    expect(await cache.getLatestTrade({ symbol: "AAPL" })).toEqual(trade);
  });

  it("keeps latest quotes and trades isolated by venue", async () => {
    const cache = new MemoryMarketDataCache();
    const coinbaseQuote: MarketQuote = {
      type: "quote",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      bidPrice: "65000",
      bidQuantity: "1",
      askPrice: "65001",
      askQuantity: "1",
      timestamp: "2026-01-01T14:30:00.000Z",
    };
    const binanceTrade: MarketTrade = {
      type: "trade",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "BINANCE",
      price: "65000.5",
      quantity: "0.1",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestQuote(coinbaseQuote);
    await cache.setLatestTrade(binanceTrade);

    await expect(cache.getLatestQuote({ symbol: "btc/usdt", venue: "coinbase" })).resolves.toEqual(
      coinbaseQuote,
    );
    await expect(
      cache.getLatestQuote({ symbol: "BTC/USDT", venue: "BINANCE" }),
    ).resolves.toBeUndefined();
    await expect(cache.getLatestTrade({ symbol: "btc/usdt", venue: "binance" })).resolves.toEqual(
      binanceTrade,
    );
    await expect(cache.getLatestTrade({ symbol: "BTC/USDT" })).resolves.toBeUndefined();
  });

  it("stores and returns a venue-specific order-book snapshot", async () => {
    const cache = new MemoryMarketDataCache();
    const snapshot: OrderBookSnapshot = {
      type: "order_book_snapshot",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: [{ price: "65000", quantity: "1.25" }],
      asks: [{ price: "65000.5", quantity: "0.8" }],
      timestamp: "2026-01-01T14:30:00.000Z",
      sequence: 100,
    };

    await cache.setOrderBookSnapshot(snapshot);

    await expect(
      cache.getOrderBookSnapshot({
        symbol: "btc/usdt",
        venue: "coinbase",
      }),
    ).resolves.toEqual(snapshot);
  });

  it("keeps venue-specific order books isolated", async () => {
    const cache = new MemoryMarketDataCache();
    const snapshot: OrderBookSnapshot = {
      type: "order_book_snapshot",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: [{ price: "65000", quantity: "1.25" }],
      asks: [{ price: "65000.5", quantity: "0.8" }],
      timestamp: "2026-01-01T14:30:00.000Z",
      sequence: 100,
    };

    await cache.setOrderBookSnapshot(snapshot);

    await expect(
      cache.getOrderBookSnapshot({
        symbol: "BTC/USDT",
        venue: "BINANCE",
      }),
    ).resolves.toBeUndefined();

    await expect(
      cache.getOrderBookSnapshot({
        symbol: "BTC/USDT",
      }),
    ).resolves.toBeUndefined();
  });

  it("stores and returns marketSummaries", async () => {
    const cache = new MemoryMarketDataCache();
    const marketSummaries: Record<string, MarketSummary> = {
      AAPL: {
        symbol: "AAPL",
        assetClass: "equity",
        price: "195.12",
        previousClose: "190",
      },
    };

    await cache.setMarketSummaries(marketSummaries);

    expect(await cache.getMarketSummaries()).toEqual(marketSummaries);
  });

  it("rejects market-summary batches whose keys disagree with their values", async () => {
    const cache = new MemoryMarketDataCache();

    await expect(
      cache.setMarketSummaries({
        MSFT: {
          symbol: "AAPL",
          assetClass: "equity",
          price: "195.12",
        },
      }),
    ).rejects.toMatchObject({ name: "ZodError" });

    await expect(cache.getMarketSummaries()).resolves.toEqual({});
  });

  it("stores and returns one market summary", async () => {
    const cache = new MemoryMarketDataCache();
    const marketSummary: MarketSummary = {
      symbol: "AAPL",
      assetClass: "equity",
      price: "195.12",
    };

    await cache.setMarketSummary(marketSummary);

    await expect(cache.getMarketSummary("aapl")).resolves.toEqual(marketSummary);
  });

  it("appends and returns bars by symbol and timeframe", async () => {
    const cache = new MemoryMarketDataCache();
    const bar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: "190",
      high: "196",
      low: "189",
      close: "195",
      volume: "120000",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.appendBar(bar);

    expect(await cache.getBars({ symbol: "AAPL", timeframe: "1Min" })).toEqual([bar]);
    expect(await cache.getBars({ symbol: "AAPL", timeframe: "5Min" })).toEqual([]);
  });

  it("keeps bars isolated by venue", async () => {
    const cache = new MemoryMarketDataCache();

    const coinbaseBar: MarketBar = {
      type: "bar",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      timeframe: "1Min",
      open: "65000",
      high: "65100",
      low: "64950",
      close: "65050",
      volume: "12.5",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    const binanceBar: MarketBar = {
      ...coinbaseBar,
      venue: "BINANCE",
      high: "65120",
      close: "65075",
      volume: "18.25",
    };

    await cache.appendBar(coinbaseBar);
    await cache.appendBar(binanceBar);

    await expect(
      cache.getBars({
        symbol: "btc/usdt",
        venue: "coinbase",
        timeframe: "1Min",
      }),
    ).resolves.toEqual([coinbaseBar]);

    await expect(
      cache.getBars({
        symbol: "BTC/USDT",
        venue: "BINANCE",
        timeframe: "1Min",
      }),
    ).resolves.toEqual([binanceBar]);

    await expect(
      cache.getBars({
        symbol: "BTC/USDT",
        timeframe: "1Min",
      }),
    ).resolves.toEqual([]);
  });

  it("orders bars chronologically regardless of insertion order", async () => {
    const cache = new MemoryMarketDataCache();

    const laterBar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: "195",
      high: "197",
      low: "194",
      close: "196",
      volume: "1100",
      timestamp: "2026-01-01T14:31:00.000Z",
    };

    const earlierBar: MarketBar = {
      ...laterBar,
      open: "194",
      high: "196",
      low: "193",
      close: "195",
      volume: "1000",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.appendBar(laterBar);
    await cache.appendBar(earlierBar);

    await expect(
      cache.getBars({
        symbol: "AAPL",
        timeframe: "1Min",
      }),
    ).resolves.toEqual([earlierBar, laterBar]);
  });

  it("replaces a bar with the same timestamp", async () => {
    const cache = new MemoryMarketDataCache();

    const initialBar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: "194",
      high: "196",
      low: "193",
      close: "195",
      volume: "1000",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    const correctedBar: MarketBar = {
      ...initialBar,
      high: "197",
      close: "196",
      volume: "1200",
    };

    await cache.appendBar(initialBar);
    await cache.appendBar(correctedBar);

    await expect(
      cache.getBars({
        symbol: "AAPL",
        timeframe: "1Min",
      }),
    ).resolves.toEqual([correctedBar]);
  });

  it("applies inclusive bar ranges", async () => {
    const cache = new MemoryMarketDataCache();

    const firstBar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: "194",
      high: "196",
      low: "193",
      close: "195",
      volume: "1000",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    const secondBar: MarketBar = {
      ...firstBar,
      timestamp: "2026-01-01T14:31:00.000Z",
    };

    const thirdBar: MarketBar = {
      ...firstBar,
      timestamp: "2026-01-01T14:32:00.000Z",
    };

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);
    await cache.appendBar(thirdBar);

    await expect(
      cache.getBars({
        symbol: "AAPL",
        timeframe: "1Min",
        start: secondBar.timestamp,
        end: thirdBar.timestamp,
      }),
    ).resolves.toEqual([secondBar, thirdBar]);
  });

  it("returns the most recent limited bars chronologically", async () => {
    const cache = new MemoryMarketDataCache();

    const firstBar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: "194",
      high: "196",
      low: "193",
      close: "195",
      volume: "1000",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    const secondBar: MarketBar = {
      ...firstBar,
      timestamp: "2026-01-01T14:31:00.000Z",
    };

    const thirdBar: MarketBar = {
      ...firstBar,
      timestamp: "2026-01-01T14:32:00.000Z",
    };

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);
    await cache.appendBar(thirdBar);

    await expect(
      cache.getBars({
        symbol: "AAPL",
        timeframe: "1Min",
        limit: 2,
      }),
    ).resolves.toEqual([secondBar, thirdBar]);
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
      assetClass: "equity",
      price: "195.12",
      quantity: "100",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.setLatestTrade(trade);

    expect(await cache.getLatestTrade({ symbol: "AAPL" })).toEqual(trade);
  });

  it("normalizes bar lookup symbols", async () => {
    const cache = new MemoryMarketDataCache();
    const bar: MarketBar = {
      type: "bar",
      symbol: "aapl",
      assetClass: "equity",
      timeframe: "1Min",
      open: "190",
      high: "196",
      low: "189",
      close: "195",
      volume: "120000",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.appendBar(bar);

    expect(await cache.getBars({ symbol: "AAPL", timeframe: "1Min" })).toEqual([bar]);
  });
});
