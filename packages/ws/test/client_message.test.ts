import { describe, expect, it } from "vitest";
import { parseRelayClientMessage } from "../src/client_message.js";

describe("parseRelayClientMessage", () => {
  it("parses channel subscriptions", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_channels",
          channels: ["trade", "bar"],
        }),
      ),
    ).toEqual({
      type: "subscribe_channels",
      channels: ["trade", "bar"],
    });
  });

  it("parses market summaries subscriptions", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_market_summaries",
          symbols: ["AAPL", "MSFT"],
        }),
      ),
    ).toEqual({
      type: "subscribe_market_summaries",
      symbols: ["AAPL", "MSFT"],
    });
  });

  it("parses quote subscriptions", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_quotes",
          quotes: [{ symbol: "AAPL" }, { symbol: "MSFT", venue: "NASDAQ" }],
        }),
      ),
    ).toEqual({
      type: "subscribe_quotes",
      quotes: [{ symbol: "AAPL" }, { symbol: "MSFT", venue: "NASDAQ" }],
    });
  });

  it("parses trade subscriptions", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_trades",
          trades: [{ symbol: "AAPL" }, { symbol: "MSFT", venue: "NASDAQ" }],
        }),
      ),
    ).toEqual({
      type: "subscribe_trades",
      trades: [{ symbol: "AAPL" }, { symbol: "MSFT", venue: "NASDAQ" }],
    });
  });

  it("parses venue-aware order-book subscriptions", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_order_books",
          orderBooks: [
            {
              symbol: "BTC/USDT",
              venue: "COINBASE",
            },
            {
              symbol: "BTC/USDT",
              venue: "BINANCE",
            },
          ],
        }),
      ),
    ).toEqual({
      type: "subscribe_order_books",
      orderBooks: [
        {
          symbol: "BTC/USDT",
          venue: "COINBASE",
        },
        {
          symbol: "BTC/USDT",
          venue: "BINANCE",
        },
      ],
    });
  });

  it("parses order-book unsubscriptions", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "unsubscribe_order_books",
          orderBooks: [
            {
              symbol: "BTC/USDT",
              venue: "COINBASE",
            },
          ],
        }),
      ),
    ).toEqual({
      type: "unsubscribe_order_books",
      orderBooks: [
        {
          symbol: "BTC/USDT",
          venue: "COINBASE",
        },
      ],
    });
  });

  it("rejects invalid order-book requests", () => {
    expect(() =>
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_order_books",
          orderBooks: [
            {
              symbol: "BTC/USDT",
              venue: 123,
            },
          ],
        }),
      ),
    ).toThrow("Client message orderBooks must be an array of order-book requests.");
  });

  it("parses bar subscriptions", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_bars",
          bars: [{ symbol: "AAPL", timeframe: "1Min" }],
        }),
      ),
    ).toEqual({
      type: "subscribe_bars",
      bars: [{ symbol: "AAPL", timeframe: "1Min" }],
    });
  });

  it("parses hydration requests", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "hydrate",
          request: {
            symbols: ["AAPL"],
            includeMarketSummaries: true,
            quotes: [{ symbol: "AAPL" }],
          },
        }),
      ),
    ).toEqual({
      type: "hydrate",
      request: {
        symbols: ["AAPL"],
        includeMarketSummaries: true,
        quotes: [{ symbol: "AAPL" }],
      },
    });
  });

  it("rejects unsupported message types", () => {
    expect(() =>
      parseRelayClientMessage(
        JSON.stringify({
          type: "unknown",
        }),
      ),
    ).toThrow("Unsupported client message type.");
  });
});
