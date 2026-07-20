import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL, createRelayMessage } from "@zagvar/relay-core";
import { RedisRelayEventBus } from "../src/redis_relay_event_bus.js";
import { RelayRedisKeys } from "../src/redis_keys.js";
import { FakeRedisPubSubClient } from "./fake_redis_pubsub_client.js";

const trade = {
  type: "trade",
  symbol: "AAPL",
  assetClass: "equity",
  price: "195.12",
  quantity: "100",
  timestamp: "2026-07-20T01:00:00Z",
} as const;

describe("RedisRelayEventBus", () => {
  it("publishes messages to subscribers on the same channel", async () => {
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
    });
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
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
    });
    const receivedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.bar, (message) => {
      receivedMessages.push(message);
    });

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(receivedMessages).toEqual([]);
  });

  it("stops publishing after unsubscribe", async () => {
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
    });
    const receivedMessages: unknown[] = [];

    const unsubscribe = await eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      receivedMessages.push(message);
    });

    await unsubscribe();

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

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

  it("rejects numeric economic values received from Redis", async () => {
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
    });
    const keys = new RelayRedisKeys();
    const receivedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.trade, (message) => {
      receivedMessages.push(message);
    });

    await expect(
      client.publish(
        keys.eventChannel(MARKET_EVENT_CHANNEL.trade),
        JSON.stringify({
          channel: MARKET_EVENT_CHANNEL.trade,
          data: {
            ...trade,
            price: 195.12,
          },
        }),
      ),
    ).rejects.toThrow();

    expect(receivedMessages).toEqual([]);
  });

  it("rejects messages delivered through the wrong Redis channel", async () => {
    const client = new FakeRedisPubSubClient();
    const eventBus = new RedisRelayEventBus({
      publisher: client,
      subscriber: client,
    });
    const keys = new RelayRedisKeys();
    const receivedMessages: unknown[] = [];

    await eventBus.subscribe(MARKET_EVENT_CHANNEL.quote, (message) => {
      receivedMessages.push(message);
    });

    await expect(
      client.publish(
        keys.eventChannel(MARKET_EVENT_CHANNEL.quote),
        JSON.stringify(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade)),
      ),
    ).rejects.toThrow();

    expect(receivedMessages).toEqual([]);
  });
});
