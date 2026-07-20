import { describe, expect, it } from "vitest";
import { RedisMarketDataCache } from "../src/redis_market_data_cache.js";
import { RelayRedisKeys } from "../src/redis_keys.js";
import { FakeRedisClient } from "./fake_redis_client.js";
import type {
  MarketBar,
  MarketClock,
  MarketQuote,
  MarketSummary,
  MarketTrade,
  OrderBookSnapshot,
} from "@zagvar/relay-core";

function createAaplBar(timestamp: string, overrides: Partial<MarketBar> = {}): MarketBar {
  return {
    type: "bar",
    symbol: "AAPL",
    assetClass: "equity",
    timeframe: "1Min",
    open: "194",
    high: "196",
    low: "193",
    close: "195",
    volume: "1000",
    timestamp,
    ...overrides,
  };
}

describe("RedisMarketDataCache", () => {
  it("stores and returns latest quotes", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
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

    await expect(cache.getLatestQuote({ symbol: "aapl" })).resolves.toEqual(quote);
  });

  it("stores and returns latest trades", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
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

  it("keeps Redis quotes and trades isolated by venue", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
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

    await cache.setLatestQuote(coinbaseQuote);

    await expect(cache.getLatestQuote({ symbol: "btc/usdt", venue: "coinbase" })).resolves.toEqual(
      coinbaseQuote,
    );
    await expect(
      cache.getLatestQuote({ symbol: "BTC/USDT", venue: "BINANCE" }),
    ).resolves.toBeUndefined();
  });

  it("stores and returns a venue-specific order-book snapshot", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
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

  it("keeps Redis order books isolated by venue", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
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

  it("stores and returns one market summary", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const marketSummary: MarketSummary = {
      symbol: "AAPL",
      assetClass: "equity",
      price: "195.12",
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
        assetClass: "equity",
        price: "195.12",
      },
    };

    await cache.setMarketSummaries(marketSummaries);

    expect(await cache.getMarketSummaries()).toEqual({
      AAPL: marketSummaries.aapl,
    });
  });

  it("rejects market-summary batches whose keys disagree with their values", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });

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

  it("expires marketSummaries when ttl is configured", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({
      client,
      marketSummaryTtlSeconds: 5,
    });

    await cache.setMarketSummaries({
      AAPL: {
        symbol: "AAPL",
        assetClass: "equity",
        price: "195.12",
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
      assetClass: "equity",
      timeframe: "1Min",
      open: "190",
      high: "196",
      low: "189",
      close: "195",
      volume: "120000",
      timestamp: "2026-01-01T14:31:00.000Z",
    };
    const secondBar: MarketBar = {
      ...firstBar,
      close: "194",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);

    expect(await cache.getBars({ symbol: "aapl", timeframe: "1Min" })).toEqual([
      secondBar,
      firstBar,
    ]);
  });

  it("keeps Redis bars isolated by venue", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });

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
      assetClass: "equity",
      timeframe: "1Min",
      open: "190",
      high: "196",
      low: "189",
      close: "195",
      volume: "120000",
      timestamp,
    });

    const firstBar = createBar("2026-01-01T14:30:00.000Z");
    const secondBar = createBar("2026-01-01T14:31:00.000Z");
    const thirdBar = createBar("2026-01-01T14:32:00.000Z");

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);
    await cache.appendBar(thirdBar);

    expect(await cache.getBars({ symbol: "AAPL", timeframe: "1Min" })).toEqual([
      secondBar,
      thirdBar,
    ]);
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

    client.advanceTime(5_000);

    expect(await cache.getBars({ symbol: "AAPL", timeframe: "1Min" })).toEqual([]);
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
      assetClass: "equity",
      timeframe: "5Min",
      open: "190",
      high: "196",
      low: "189",
      close: "195",
      volume: "120000",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    const secondBar: MarketBar = {
      ...firstBar,
      timestamp: "2026-01-01T14:35:00.000Z",
    };

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);

    expect(await cache.getBars({ symbol: "AAPL", timeframe: "5Min" })).toEqual([secondBar]);
  });

  it("replaces a Redis bar with the same timestamp", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });

    const initialBar = createAaplBar("2026-01-01T14:30:00.000Z");

    const correctedBar = createAaplBar("2026-01-01T14:30:00.000Z", {
      high: "197",
      close: "196",
      volume: "1200",
    });

    await cache.appendBar(initialBar);
    await cache.appendBar(correctedBar);

    await expect(
      cache.getBars({
        symbol: "AAPL",
        timeframe: "1Min",
      }),
    ).resolves.toEqual([correctedBar]);
  });

  it("applies inclusive Redis bar ranges", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });

    const firstBar = createAaplBar("2026-01-01T14:30:00.000Z");
    const secondBar = createAaplBar("2026-01-01T14:31:00.000Z");
    const thirdBar = createAaplBar("2026-01-01T14:32:00.000Z");

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

  it("returns the most recent limited Redis bars chronologically", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });

    const firstBar = createAaplBar("2026-01-01T14:30:00.000Z");
    const secondBar = createAaplBar("2026-01-01T14:31:00.000Z");
    const thirdBar = createAaplBar("2026-01-01T14:32:00.000Z");

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

  it("limits within the requested Redis bar range", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });

    const firstBar = createAaplBar("2026-01-01T14:30:00.000Z");
    const secondBar = createAaplBar("2026-01-01T14:31:00.000Z");
    const thirdBar = createAaplBar("2026-01-01T14:32:00.000Z");
    const fourthBar = createAaplBar("2026-01-01T14:33:00.000Z");

    await cache.appendBar(firstBar);
    await cache.appendBar(secondBar);
    await cache.appendBar(thirdBar);
    await cache.appendBar(fourthBar);

    await expect(
      cache.getBars({
        symbol: "AAPL",
        timeframe: "1Min",
        start: firstBar.timestamp,
        end: thirdBar.timestamp,
        limit: 2,
      }),
    ).resolves.toEqual([secondBar, thirdBar]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid market-summary TTL %s",
    (ttlSeconds) => {
      const client = new FakeRedisClient();

      expect(
        () =>
          new RedisMarketDataCache({
            client,
            marketSummaryTtlSeconds: ttlSeconds,
          }),
      ).toThrow(RangeError);
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid market-clock TTL %s",
    (ttlSeconds) => {
      const client = new FakeRedisClient();

      expect(
        () =>
          new RedisMarketDataCache({
            client,
            marketClockTtlSeconds: ttlSeconds,
          }),
      ).toThrow(RangeError);
    },
  );

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER])("rejects invalid maxBars %s", (maxBars) => {
    const client = new FakeRedisClient();

    expect(
      () =>
        new RedisMarketDataCache({
          client,
          barRetention: {
            default: { maxBars },
          },
        }),
    ).toThrow(RangeError);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])("rejects invalid bar TTL %s", (ttlSeconds) => {
    const client = new FakeRedisClient();

    expect(
      () =>
        new RedisMarketDataCache({
          client,
          barRetention: {
            default: { ttlSeconds },
          },
        }),
    ).toThrow(RangeError);
  });

  it.each(["", " 1Min", "1Min ", "A".repeat(33)])(
    "rejects invalid retention timeframe %j",
    (timeframe) => {
      const client = new FakeRedisClient();

      expect(
        () =>
          new RedisMarketDataCache({
            client,
            barRetention: {
              byTimeframe: {
                [timeframe]: {
                  maxBars: 100,
                },
              },
            },
          }),
      ).toThrow(TypeError);
    },
  );

  it("rejects cached legacy numeric economic values", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const keys = new RelayRedisKeys();

    await client.hSet(
      keys.latestTrades(),
      keys.marketDataField({ symbol: "AAPL" }),
      JSON.stringify({
        type: "trade",
        symbol: "AAPL",
        assetClass: "equity",
        price: 195.12,
        quantity: 100,
        timestamp: "2026-01-01T14:30:00.000Z",
      }),
    );

    await expect(cache.getLatestTrade({ symbol: "AAPL" })).rejects.toThrow();
  });

  it("rejects cached non-canonical decimal strings", async () => {
    const client = new FakeRedisClient();
    const cache = new RedisMarketDataCache({ client });
    const keys = new RelayRedisKeys();

    await client.hSet(
      keys.latestTrades(),
      keys.marketDataField({ symbol: "AAPL" }),
      JSON.stringify({
        type: "trade",
        symbol: "AAPL",
        assetClass: "equity",
        price: "195.120",
        quantity: "100",
        timestamp: "2026-01-01T14:30:00.000Z",
      }),
    );

    await expect(cache.getLatestTrade({ symbol: "AAPL" })).rejects.toThrow();
  });
});
