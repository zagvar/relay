import { describe, expect, it } from "vitest";
import type {
  MarketBar,
  MarketIdentity,
  MarketQuote,
  MarketSummary,
  MarketTrade,
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
      bidPrice: 195.1,
      bidQuantity: 200,
      askPrice: 195.12,
      askQuantity: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    const trade: MarketTrade = {
      type: "trade",
      symbol: "BTC/USD",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      price: 109_500,
      quantity: 0.05,
      timestamp: "2026-01-01T00:00:00.000Z",
    };

    const bar: MarketBar = {
      type: "bar",
      symbol: "BTC/USD",
      timeframe: "1Min",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      open: 109_000,
      high: 110_000,
      low: 108_900,
      close: 109_500,
      volume: 12.5,
      timestamp: "2026-01-01T00:00:00.000Z",
    };

    const snapshot: MarketSummary = {
      symbol: "BTC/USD",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      price: 109_500,
    };

    expect(quote.askPrice).toBe(195.12);
    expect(trade.assetClass).toBe("crypto");
    expect(bar.baseAsset).toBe("BTC");
    expect(snapshot.quoteAsset).toBe("USD");
  });
});
