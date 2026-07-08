import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL, createRelayMessage } from "../src/event_channel.js";

describe("createRelayMessage", () => {
  it("creates a normalized relay message", () => {
    expect(createRelayMessage(MARKET_EVENT_CHANNEL.trade, { symbol: "AAPL" })).toEqual({
      channel: "trade",
      data: { symbol: "AAPL" },
    });
  });
});
