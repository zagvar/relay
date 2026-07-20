import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL, createRelayMessage } from "../src/event_channel.js";

const trade = {
  type: "trade",
  symbol: "AAPL",
  assetClass: "equity",
  price: "195.12",
  quantity: "100",
  timestamp: "2026-07-20T01:00:00Z",
} as const;

describe("createRelayMessage", () => {
  it("creates a normalized relay message", () => {
    expect(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade)).toEqual({
      channel: "trade",
      data: trade,
    });
  });
});
