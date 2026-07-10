import { describe, expect, it } from "vitest";
import { isAlpacaStockMarketDataMessage, parseAlpacaWebSocketMessageBatch } from "../src/index.js";

describe("Alpaca websocket parser", () => {
  it("parses websocket control messages", () => {
    expect(parseAlpacaWebSocketMessageBatch('[{"T":"success","msg":"connected"}]')).toEqual([
      {
        T: "success",
        msg: "connected",
      },
    ]);
  });

  it("parses market data message batches", () => {
    const messages = parseAlpacaWebSocketMessageBatch(
      JSON.stringify([
        {
          T: "q",
          S: "FAKEPACA",
          bx: "O",
          bp: 133.85,
          bs: 4,
          ax: "R",
          ap: 135.77,
          as: 5,
          c: ["R"],
          z: "A",
          t: "2024-07-24T07:56:53.639713735Z",
        },
        {
          T: "b",
          S: "FAKEPACA",
          o: 132.65,
          h: 136,
          l: 132.12,
          c: 134.65,
          v: 205,
          t: "2024-07-24T07:56:00Z",
          n: 16,
          vw: 133.7,
        },
      ]),
    );

    expect(messages).toHaveLength(2);
    expect(messages.every(isAlpacaStockMarketDataMessage)).toBe(true);
  });

  it("rejects non-array payloads", () => {
    expect(() => {
      parseAlpacaWebSocketMessageBatch('{"T":"success","msg":"connected"}');
    }).toThrow("Expected Alpaca websocket payload to be an array.");
  });

  it("rejects unsupported message shapes", () => {
    expect(() => {
      parseAlpacaWebSocketMessageBatch('[{"T":"q","S":"AAPL"}]');
    }).toThrow("Unsupported Alpaca websocket message.");
  });
});
