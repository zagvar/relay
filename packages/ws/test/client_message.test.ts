import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  RELAY_CLIENT_MESSAGE_MAX_BYTES,
  RELAY_CLIENT_MESSAGE_MAX_ITEMS,
  parseRelayClientMessage,
} from "../src/client_message.js";

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
    ).toThrow(ZodError);
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
    ).toThrow(ZodError);
  });

  it("rejects unknown message properties", () => {
    expect(() =>
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_trades",
          trades: [{ symbol: "AAPL" }],
          unexpected: true,
        }),
      ),
    ).toThrow(ZodError);
  });

  it("rejects duplicate normalized subscriptions", () => {
    expect(() =>
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_market_summaries",
          symbols: ["AAPL", "aapl"],
        }),
      ),
    ).toThrow(ZodError);

    expect(() =>
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_quotes",
          quotes: [
            {
              symbol: "BTC/USDT",
              venue: "COINBASE",
            },
            {
              symbol: "btc/usdt",
              venue: "coinbase",
            },
          ],
        }),
      ),
    ).toThrow(ZodError);
  });

  it("rejects excessive subscription cardinality", () => {
    const symbols = Array.from(
      {
        length: RELAY_CLIENT_MESSAGE_MAX_ITEMS + 1,
      },
      (_, index) => `SYMBOL-${String(index)}`,
    );

    expect(() =>
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_market_summaries",
          symbols,
        }),
      ),
    ).toThrow(ZodError);
  });

  it("rejects excessive total hydration cardinality", () => {
    const symbols = Array.from({ length: 251 }, (_, index) => `SYMBOL-${String(index)}`);

    const quotes = Array.from({ length: 250 }, (_, index) => ({
      symbol: `QUOTE-${String(index)}`,
    }));

    expect(() =>
      parseRelayClientMessage(
        JSON.stringify({
          type: "hydrate",
          request: {
            symbols,
            quotes,
          },
        }),
      ),
    ).toThrow(ZodError);
  });

  it("rejects oversized client messages before JSON parsing", () => {
    const rawMessage = "x".repeat(RELAY_CLIENT_MESSAGE_MAX_BYTES + 1);

    expect(() => parseRelayClientMessage(rawMessage)).toThrow(RangeError);
  });

  it("rejects historical-only fields in live bar subscriptions", () => {
    expect(() =>
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_bars",
          bars: [
            {
              symbol: "AAPL",
              timeframe: "1Min",
              limit: 100,
            },
          ],
        }),
      ),
    ).toThrow(ZodError);
  });
});
