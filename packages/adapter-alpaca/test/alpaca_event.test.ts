import { describe, expect, it } from "vitest";
import { AlpacaWebSocketError, parseAlpacaStockMarketEvents } from "../src/index.js";

describe("Alpaca event parser", () => {
  it("preserves precise decimal literals from raw websocket JSON", () => {
    expect(
      parseAlpacaStockMarketEvents(
        '[{"T":"t","i":96921,"S":"AAPL","x":"D","p":126.550000000000000001,"s":0.000000000000000001,"t":"2021-02-22T15:51:44.208Z","c":["@"],"z":"C"}]',
      ),
    ).toMatchObject([
      {
        type: "trade",
        price: "126.550000000000000001",
        quantity: "0.000000000000000001",
      },
    ]);
  });

  it("maps stock market data messages to Relay events", () => {
    expect(
      parseAlpacaStockMarketEvents(
        JSON.stringify([
          {
            T: "success",
            msg: "authenticated",
          },
          {
            T: "t",
            i: 96921,
            S: "aapl",
            x: "D",
            p: 126.55,
            s: 1,
            t: "2021-02-22T15:51:44.208Z",
            c: ["@", "I"],
            z: "C",
          },
          {
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
          },
        ]),
      ),
    ).toEqual([
      {
        type: "trade",
        symbol: "AAPL",
        assetClass: "equity",
        quoteAsset: "USD",
        venue: "D",
        providerTradeId: "96921",
        price: "126.55",
        quantity: "1",
        timestamp: "2021-02-22T15:51:44.208Z",
      },
      {
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
      },
    ]);
  });

  it("ignores non-error control messages", () => {
    expect(
      parseAlpacaStockMarketEvents(
        JSON.stringify([
          {
            T: "success",
            msg: "connected",
          },
          {
            T: "subscription",
            trades: ["AAPL"],
            quotes: [],
            bars: [],
          },
        ]),
      ),
    ).toEqual([]);
  });

  it("throws Alpaca websocket errors", () => {
    expect(() => {
      parseAlpacaStockMarketEvents(
        JSON.stringify([
          {
            T: "error",
            code: 406,
            msg: "connection limit exceeded",
          },
        ]),
      );
    }).toThrow(AlpacaWebSocketError);
  });

  it("includes Alpaca error code on thrown errors", () => {
    try {
      parseAlpacaStockMarketEvents(
        JSON.stringify([
          {
            T: "error",
            code: 409,
            msg: "insufficient subscription",
          },
        ]),
      );
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AlpacaWebSocketError);

      if (error instanceof AlpacaWebSocketError) {
        expect(error.code).toBe(409);
        expect(error.message).toBe("Alpaca websocket error 409: insufficient subscription");
      }

      return;
    }

    throw new Error("Expected AlpacaWebSocketError to be thrown.");
  });
});
