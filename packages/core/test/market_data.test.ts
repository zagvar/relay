import { describe, expect, it } from "vitest";
import type {
  MarketBar,
  MarketIdentity,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "../src/market_data.js";
import {
  barsRequestSchema,
  marketBarSchema,
  marketQuoteSchema,
  marketSummarySchema,
} from "../src/market_data.js";

describe("market data types", () => {
  it("supports equity identities", () => {
    const identity: MarketIdentity = {
      symbol: "AAPL",
      assetClass: "equity",
      venue: "NASDAQ",
      quoteAsset: "USD",
    };

    expect(identity).toEqual({
      symbol: "AAPL",
      assetClass: "equity",
      venue: "NASDAQ",
      quoteAsset: "USD",
    });
  });

  it("supports digital-asset pair identities", () => {
    const identity: MarketIdentity = {
      symbol: "BTC/USDT",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      venue: "COINBASE",
    };

    expect(identity).toEqual({
      symbol: "BTC/USDT",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      venue: "COINBASE",
    });
  });

  it("allows asset metadata on normalized events", () => {
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

    const trade: MarketTrade = {
      type: "trade",
      symbol: "BTC/USD",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      price: "109500",
      quantity: "0.05",
      timestamp: "2026-01-01T00:00:00.000Z",
    };

    const bar: MarketBar = {
      type: "bar",
      symbol: "BTC/USD",
      timeframe: "1Min",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      open: "109000",
      high: "110000",
      low: "108900",
      close: "109500",
      volume: "12.5",
      timestamp: "2026-01-01T00:00:00.000Z",
    };

    const snapshot: MarketSummary = {
      symbol: "BTC/USD",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      price: "109500",
    };

    expect(quote.askPrice).toBe("195.12");
    expect(trade.assetClass).toBe("crypto");
    expect(bar.baseAsset).toBe("BTC");
    expect(snapshot.quoteAsset).toBe("USD");
  });

  it("allows locked quotes and rejects crossed quotes", () => {
    const quote = {
      type: "quote",
      symbol: "AAPL",
      assetClass: "equity",
      bidPrice: "195",
      bidQuantity: "10",
      askPrice: "195",
      askQuantity: "12",
      timestamp: "2026-07-20T01:00:00Z",
    } as const;

    expect(marketQuoteSchema.safeParse(quote).success).toBe(true);

    const crossedResult = marketQuoteSchema.safeParse({
      ...quote,
      bidPrice: "195.01",
    });

    expect(crossedResult.success).toBe(false);

    if (!crossedResult.success) {
      expect(crossedResult.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["bidPrice"],
          }),
        ]),
      );
    }
  });

  it("requires internally consistent OHLC bars", () => {
    const bar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: "194",
      high: "196",
      low: "193",
      close: "195",
      volume: "1000",
      volumeWeightedAveragePrice: "194.5",
      timestamp: "2026-07-20T01:00:00Z",
    } as const;

    expect(marketBarSchema.safeParse(bar).success).toBe(true);

    expect(
      marketBarSchema.safeParse({
        ...bar,
        high: "192",
      }).success,
    ).toBe(false);

    expect(
      marketBarSchema.safeParse({
        ...bar,
        open: "192",
      }).success,
    ).toBe(false);

    expect(
      marketBarSchema.safeParse({
        ...bar,
        close: "197",
      }).success,
    ).toBe(false);

    expect(
      marketBarSchema.safeParse({
        ...bar,
        volumeWeightedAveragePrice: "197",
      }).success,
    ).toBe(false);
  });

  it("rejects inconsistent summary ranges and crossed quotes", () => {
    const summary = {
      symbol: "AAPL",
      assetClass: "equity",
      price: "195",
      low: "193",
      high: "196",
      bidPrice: "194.9",
      askPrice: "195.1",
    } as const;

    expect(marketSummarySchema.safeParse(summary).success).toBe(true);

    expect(
      marketSummarySchema.safeParse({
        ...summary,
        high: "192",
      }).success,
    ).toBe(false);

    expect(
      marketSummarySchema.safeParse({
        ...summary,
        bidPrice: "195.2",
      }).success,
    ).toBe(false);
  });

  it("requires chronological historical-bar ranges", () => {
    expect(
      barsRequestSchema.safeParse({
        symbol: "AAPL",
        timeframe: "1Min",
        start: "2026-07-20T00:00:00Z",
        end: "2026-07-20T01:00:00Z",
      }).success,
    ).toBe(true);

    expect(
      barsRequestSchema.safeParse({
        symbol: "AAPL",
        timeframe: "1Min",
        start: "2026-07-20T01:00:00Z",
        end: "2026-07-20T00:00:00Z",
      }).success,
    ).toBe(false);
  });
});
