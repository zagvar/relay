import { describe, expect, it } from "vitest";
import {
  barsRequestSchema,
  marketBarSchema,
  marketEventSchema,
  marketQuoteSchema,
  marketSummarySchema,
  marketTradeSchema,
} from "../src/index.js";

const validTrade = {
  type: "trade",
  symbol: "AAPL",
  assetClass: "equity",
  quoteAsset: "USD",
  venue: "NASDAQ",
  providerTradeId: "trade-1",
  price: "195.12",
  quantity: "100",
  timestamp: "2026-07-20T01:00:00Z",
} as const;

describe("market data runtime schemas", () => {
  it("parses canonical decimal-string market events", () => {
    expect(marketTradeSchema.parse(validTrade)).toEqual(validTrade);
    expect(marketEventSchema.parse(validTrade)).toEqual(validTrade);
  });

  it("rejects the previous numeric economic-value representation", () => {
    expect(
      marketTradeSchema.safeParse({
        ...validTrade,
        price: 195.12,
      }).success,
    ).toBe(false);

    expect(
      marketTradeSchema.safeParse({
        ...validTrade,
        quantity: 100,
      }).success,
    ).toBe(false);
  });

  it.each(["195.120", "1e2", "0195.12", "-1"])(
    "rejects non-canonical unsigned decimal %s",
    (price) => {
      expect(
        marketTradeSchema.safeParse({
          ...validTrade,
          price,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects unknown market-event properties", () => {
    expect(
      marketTradeSchema.safeParse({
        ...validTrade,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("accepts canonical signed summary changes", () => {
    expect(
      marketSummarySchema.safeParse({
        symbol: "AAPL",
        assetClass: "equity",
        quoteAsset: "USD",
        price: "195.12",
        change: "-2.5",
        changePercent: "-1.265",
      }).success,
    ).toBe(true);
  });

  it.each(["-2.50", "1e-2", "-0", "+1"])(
    "rejects non-canonical signed summary change %s",
    (change) => {
      expect(
        marketSummarySchema.safeParse({
          symbol: "AAPL",
          assetClass: "equity",
          price: "195.12",
          change,
        }).success,
      ).toBe(false);
    },
  );

  it("requires safe non-negative integer trade counts", () => {
    const validBar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: "194",
      high: "196",
      low: "193.5",
      close: "195.12",
      volume: "120000",
      timestamp: "2026-07-20T01:00:00Z",
    } as const;

    expect(
      marketBarSchema.safeParse({
        ...validBar,
        tradeCount: 461,
      }).success,
    ).toBe(true);

    expect(
      marketBarSchema.safeParse({
        ...validBar,
        tradeCount: 1.5,
      }).success,
    ).toBe(false);

    expect(
      marketBarSchema.safeParse({
        ...validBar,
        tradeCount: Number.MAX_SAFE_INTEGER + 1,
      }).success,
    ).toBe(false);
  });

  it("requires positive safe integer bar limits", () => {
    expect(
      barsRequestSchema.safeParse({
        symbol: "AAPL",
        timeframe: "1Min",
        limit: 100,
      }).success,
    ).toBe(true);

    for (const limit of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        barsRequestSchema.safeParse({
          symbol: "AAPL",
          timeframe: "1Min",
          limit,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects unsupported event discriminators", () => {
    expect(
      marketEventSchema.safeParse({
        ...validTrade,
        type: "market_trade",
      }).success,
    ).toBe(false);
  });

  it("enforces field-specific decimal semantics", () => {
    expect(
      marketTradeSchema.safeParse({
        ...validTrade,
        price: "0",
      }).success,
    ).toBe(false);

    expect(
      marketTradeSchema.safeParse({
        ...validTrade,
        quantity: "0",
      }).success,
    ).toBe(false);

    expect(
      marketQuoteSchema.safeParse({
        type: "quote",
        symbol: "AAPL",
        assetClass: "equity",
        bidPrice: "195",
        bidQuantity: "0",
        askPrice: "195.1",
        askQuantity: "0",
        timestamp: "2026-07-20T01:00:00Z",
      }).success,
    ).toBe(true);
  });

  it.each(["banana", "2026-07-20", "2026-07-20T01:00:00", "2026-02-30T01:00:00Z"])(
    "rejects invalid or zone-less timestamp %s",
    (timestamp) => {
      expect(
        marketTradeSchema.safeParse({
          ...validTrade,
          timestamp,
        }).success,
      ).toBe(false);
    },
  );

  it.each(["", " AAPL", "AAPL ", "   ", "A".repeat(65)])(
    "rejects invalid market identifier %j",
    (symbol) => {
      expect(
        marketTradeSchema.safeParse({
          ...validTrade,
          symbol,
        }).success,
      ).toBe(false);
    },
  );

  it("requires ISO timestamps in historical-bar requests", () => {
    expect(
      barsRequestSchema.safeParse({
        symbol: "AAPL",
        timeframe: "1Min",
        start: "2026-07-20T00:00:00Z",
        end: "2026-07-20T01:00:00+00:00",
      }).success,
    ).toBe(true);

    expect(
      barsRequestSchema.safeParse({
        symbol: "AAPL",
        timeframe: "1Min",
        start: "2026-07-20",
      }).success,
    ).toBe(false);
  });
});
