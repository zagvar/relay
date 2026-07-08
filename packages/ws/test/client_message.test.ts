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

  it("parses trade subscriptions", () => {
    expect(
      parseRelayClientMessage(
        JSON.stringify({
          type: "subscribe_trades",
          symbols: ["AAPL", "MSFT"],
        }),
      ),
    ).toEqual({
      type: "subscribe_trades",
      symbols: ["AAPL", "MSFT"],
    });
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
            includeSnapshots: true,
          },
        }),
      ),
    ).toEqual({
      type: "hydrate",
      request: {
        symbols: ["AAPL"],
        includeSnapshots: true,
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
