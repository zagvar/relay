import { describe, expect, it } from "vitest";
import type {
  MarketBar,
  MarketInstrument,
  MarketSummary,
  MarketTrade,
} from "../src/market_data.js";

describe("market data types", () => {
  it("supports equity instruments", () => {
    const instrument: MarketInstrument = {
      symbol: "AAPL",
      assetClass: "equity",
      exchange: "NASDAQ",
      currency: "USD",
    };

    expect(instrument).toEqual({
      symbol: "AAPL",
      assetClass: "equity",
      exchange: "NASDAQ",
      currency: "USD",
    });
  });

  it("supports crypto pair instruments", () => {
    const instrument: MarketInstrument = {
      symbol: "BTC/USD",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      exchange: "COINBASE",
    };

    expect(instrument).toEqual({
      symbol: "BTC/USD",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      exchange: "COINBASE",
    });
  });

  it("allows asset metadata on normalized events", () => {
    const trade: MarketTrade = {
      type: "trade",
      symbol: "BTC/USD",
      assetClass: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      price: 109_500,
      size: 0.05,
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

    expect(trade.assetClass).toBe("crypto");
    expect(bar.baseAsset).toBe("BTC");
    expect(snapshot.quoteAsset).toBe("USD");
  });
});
