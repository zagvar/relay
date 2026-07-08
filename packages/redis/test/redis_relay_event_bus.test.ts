import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL, createRelayMessage } from "@zagvar/relay-core";
import { RedisRelayEventBus } from "../src/redis_relay_event_bus.js";
import { FakeRedisPubSubClient } from "./fake_redis_pubsub_client.js";

describe("RedisRelayEventBus", () => {
  it("publishes messages to subscribers on the same channel", async () => {
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
    });
    const receivedMessages: unknown[] = [];

    eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      receivedMessages.push(message);
    });

    await eventBus.publish(
      createRelayMessage(MARKET_EVENT_CHANNEL.trade, {
        symbol: "AAPL",
      }),
    );

    expect(receivedMessages).toEqual([
      {
        channel: "trade",
        data: {
          symbol: "AAPL",
        },
      },
    ]);
  });

  it("does not publish messages to other channels", async () => {
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
    });
    const receivedMessages: unknown[] = [];

    eventBus.subscribe(MARKET_EVENT_CHANNEL.bar, (message) => {
      receivedMessages.push(message);
    });

    await eventBus.publish(
      createRelayMessage(MARKET_EVENT_CHANNEL.trade, {
        symbol: "AAPL",
      }),
    );

    expect(receivedMessages).toEqual([]);
  });

  it("stops publishing after unsubscribe", async () => {
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
    });
    const receivedMessages: unknown[] = [];

    const unsubscribe = eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      receivedMessages.push(message);
    });

    unsubscribe();

    await eventBus.publish(
      createRelayMessage(MARKET_EVENT_CHANNEL.trade, {
        symbol: "AAPL",
      }),
    );

    expect(receivedMessages).toEqual([]);
  });

  it("uses configured key prefix for pub/sub channels", async () => {
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
      prefix: "custom",
    });
    const receivedMessages: unknown[] = [];

    eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      receivedMessages.push(message);
    });

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, "payload"));

    expect(receivedMessages).toEqual([
      {
        channel: "trade",
        data: "payload",
      },
    ]);
  });
});
