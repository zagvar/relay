import { LosslessNumber } from "lossless-json";
import { describe, expect, it } from "vitest";
import {
  mapAlpacaStockBar,
  mapAlpacaStockMarketDataMessage,
  mapAlpacaStockQuote,
  mapAlpacaStockTrade,
} from "../src/index.js";

function lossless(value: string): LosslessNumber {
  return new LosslessNumber(value);
}

describe("Alpaca stock mapper", () => {
  it("maps trade messages", () => {
    expect(
      mapAlpacaStockTrade({
        T: "t",
        i: lossless("96921"),
        S: "aapl",
        x: "D",
        p: lossless("126.55"),
        s: lossless("1"),
        t: "2021-02-22T15:51:44.208Z",
        c: ["@", "I"],
        z: "C",
      }),
    ).toEqual({
      type: "trade",
      symbol: "AAPL",
      assetClass: "equity",
      quoteAsset: "USD",
      venue: "D",
      providerTradeId: "96921",
      price: "126.55",
      quantity: "1",
      timestamp: "2021-02-22T15:51:44.208Z",
    });
  });

  it("maps quote messages and converts round lots to shares", () => {
    expect(
      mapAlpacaStockQuote({
        T: "q",
        S: "AMD",
        bx: "U",
        bp: lossless("87.66"),
        bs: lossless("1"),
        ax: "Q",
        ap: lossless("87.68"),
        as: lossless("4"),
        t: "2021-02-22T15:51:45.335689322Z",
        c: ["R"],
        z: "C",
      }),
    ).toEqual({
      type: "quote",
      symbol: "AMD",
      assetClass: "equity",
      quoteAsset: "USD",
      bidVenue: "U",
      askVenue: "Q",
      bidPrice: "87.66",
      bidQuantity: "100",
      askPrice: "87.68",
      askQuantity: "400",
      timestamp: "2021-02-22T15:51:45.335689322Z",
    });
  });

  it("accepts zero-sized quotes", () => {
    expect(
      mapAlpacaStockQuote({
        T: "q",
        S: "AAPL",
        bx: "V",
        bp: lossless("195.1"),
        bs: lossless("0"),
        ax: "V",
        ap: lossless("195.12"),
        as: lossless("0"),
        t: "2026-01-01T14:30:00.000Z",
        c: [],
        z: "C",
      }),
    ).toMatchObject({
      bidQuantity: "0",
      askQuantity: "0",
    });
  });

  it("rejects crossed quotes at the adapter boundary", () => {
    expect(() =>
      mapAlpacaStockQuote({
        T: "q",
        S: "AAPL",
        bx: "V",
        bp: lossless("195.13"),
        bs: lossless("1"),
        ax: "V",
        ap: lossless("195.12"),
        as: lossless("1"),
        t: "2026-01-01T14:30:00.000Z",
        c: [],
        z: "C",
      }),
    ).toThrow(expect.objectContaining({ name: "ZodError" }));
  });

  it("maps minute bar messages", () => {
    expect(
      mapAlpacaStockBar({
        T: "b",
        S: "SPY",
        o: lossless("388.985"),
        h: lossless("389.13"),
        l: lossless("388.975"),
        c: lossless("389.12"),
        v: lossless("49378"),
        n: lossless("461"),
        vw: lossless("389.062639"),
        t: "2021-02-22T19:15:00Z",
      }),
    ).toEqual({
      type: "bar",
      symbol: "SPY",
      assetClass: "equity",
      quoteAsset: "USD",
      timeframe: "1Min",
      open: "388.985",
      high: "389.13",
      low: "388.975",
      close: "389.12",
      volume: "49378",
      tradeCount: 461,
      volumeWeightedAveragePrice: "389.062639",
      timestamp: "2021-02-22T19:15:00Z",
    });
  });

  it("maps daily bar messages", () => {
    expect(
      mapAlpacaStockMarketDataMessage({
        T: "d",
        S: "SPY",
        o: lossless("388.985"),
        h: lossless("389.13"),
        l: lossless("388.975"),
        c: lossless("389.12"),
        v: lossless("49378"),
        t: "2021-02-22T19:15:00Z",
      }),
    ).toMatchObject({
      type: "bar",
      symbol: "SPY",
      timeframe: "1Day",
    });
  });
});
