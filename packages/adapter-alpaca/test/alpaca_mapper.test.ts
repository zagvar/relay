import { describe, expect, it } from "vitest";
import {
  mapAlpacaStockBar,
  mapAlpacaStockMarketDataMessage,
  mapAlpacaStockQuote,
  mapAlpacaStockTrade,
} from "../src/index.js";

describe("Alpaca stock mapper", () => {
  it("maps trade messages", () => {
    expect(
      mapAlpacaStockTrade({
        T: "t",
        i: 96921,
        S: "aapl",
        x: "D",
        p: 126.55,
        s: 1,
        t: "2021-02-22T15:51:44.208Z",
        c: ["@", "I"],
        z: "C",
      }),
    ).toEqual({
      type: "trade",
      symbol: "AAPL",
      assetClass: "equity",
      currency: "USD",
      exchange: "D",
      providerTradeId: "96921",
      price: 126.55,
      size: 1,
      timestamp: "2021-02-22T15:51:44.208Z",
    });
  });

  it("maps quote messages and converts round lots to shares", () => {
    expect(
      mapAlpacaStockQuote({
        T: "q",
        S: "AMD",
        bx: "U",
        bp: 87.66,
        bs: 1,
        ax: "Q",
        ap: 87.68,
        as: 4,
        t: "2021-02-22T15:51:45.335689322Z",
        c: ["R"],
        z: "C",
      }),
    ).toEqual({
      type: "quote",
      symbol: "AMD",
      assetClass: "equity",
      currency: "USD",
      bidExchange: "U",
      askExchange: "Q",
      bidPrice: 87.66,
      bidSize: 100,
      askPrice: 87.68,
      askSize: 400,
      timestamp: "2021-02-22T15:51:45.335689322Z",
    });
  });

  it("maps minute bar messages", () => {
    expect(
      mapAlpacaStockBar({
        T: "b",
        S: "SPY",
        o: 388.985,
        h: 389.13,
        l: 388.975,
        c: 389.12,
        v: 49378,
        n: 461,
        vw: 389.062639,
        t: "2021-02-22T19:15:00Z",
      }),
    ).toEqual({
      type: "bar",
      symbol: "SPY",
      assetClass: "equity",
      currency: "USD",
      timeframe: "1Min",
      open: 388.985,
      high: 389.13,
      low: 388.975,
      close: 389.12,
      volume: 49378,
      tradeCount: 461,
      volumeWeightedAveragePrice: 389.062639,
      timestamp: "2021-02-22T19:15:00Z",
    });
  });

  it("maps daily bar messages", () => {
    expect(
      mapAlpacaStockMarketDataMessage({
        T: "d",
        S: "SPY",
        o: 388.985,
        h: 389.13,
        l: 388.975,
        c: 389.12,
        v: 49378,
        t: "2021-02-22T19:15:00Z",
      }),
    ).toMatchObject({
      type: "bar",
      symbol: "SPY",
      timeframe: "1Day",
    });
  });
});
