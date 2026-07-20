import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL, createRelayMessage } from "../src/event_channel.js";
import { MemoryRelayEventBus } from "../src/event_bus.js";

const trade = {
  type: "trade",
  symbol: "AAPL",
  assetClass: "equity",
  price: "195.12",
  quantity: "100",
  timestamp: "2026-07-20T01:00:00Z",
} as const;

describe("MemoryRelayEventBus", () => {
  it("publishes messages to subscribers on the same channel", async () => {
    const eventBus = new MemoryRelayEventBus();
    const receivedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      receivedMessages.push(message);
    });

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(receivedMessages).toEqual([
      {
        channel: "trade",
        data: trade,
      },
    ]);
  });

  it("does not publish messages to other channels", async () => {
    const eventBus = new MemoryRelayEventBus();
    const receivedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.bar, (message) => {
      receivedMessages.push(message);
    });

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(receivedMessages).toEqual([]);
  });

  it("stops publishing after unsubscribe", async () => {
    const eventBus = new MemoryRelayEventBus();
    const receivedMessages: unknown[] = [];

    const unsubscribe = await eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      receivedMessages.push(message);
    });

    await unsubscribe();

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(receivedMessages).toEqual([]);
  });
});
