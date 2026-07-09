import { describe, expect, it } from "vitest";
import {
  MARKET_EVENT_CHANNEL,
  MarketDataHydrator,
  MemoryMarketDataCache,
  MemoryRelayEventBus,
  createRelayMessage,
  type MarketBar,
  type MarketTrade,
} from "@zagvar/relay-core";
import { RelayClientSession } from "../src/client_session.js";
import type { RelaySocket } from "../src/socket.js";

class FakeSocket implements RelaySocket {
  readonly sentMessages: string[] = [];

  send(message: string): void {
    this.sentMessages.push(message);
  }

  get sentPayloads(): unknown[] {
    return this.sentMessages.map((message) => JSON.parse(message) as unknown);
  }
}

describe("RelayClientSession", () => {
  it("forwards subscribed trade messages", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      price: 195.12,
      size: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_trades",
        symbols: ["AAPL"],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(socket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "trade",
          data: trade,
        },
      },
    ]);
  });

  it("does not forward unsubscribed trade messages", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const trade: MarketTrade = {
      type: "trade",
      symbol: "MSFT",
      price: 420.5,
      size: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_trades",
        symbols: ["AAPL"],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(socket.sentPayloads).toEqual([]);
  });

  it("forwards subscribed bar messages", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const bar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      timeframe: "1Min",
      open: 190,
      high: 196,
      low: 189,
      close: 195,
      volume: 120_000,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_bars",
        bars: [{ symbol: "AAPL", timeframe: "1Min" }],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.bar, bar));

    expect(socket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "bar",
          data: bar,
        },
      },
    ]);
  });

  it("sends hydration payloads", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const session = new RelayClientSession({ socket, eventBus, hydrator });

    await cache.setMarketSummaries({
      AAPL: {
        symbol: "AAPL",
        price: 195.12,
      },
    });

    await session.handleMessage(
      JSON.stringify({
        type: "hydrate",
        request: {
          symbols: ["AAPL"],
          includeMarketSummaries: true,
        },
      }),
    );

    expect(socket.sentPayloads).toEqual([
      {
        type: "hydration",
        data: {
          marketSummaries: {
            AAPL: {
              symbol: "AAPL",
              price: 195.12,
            },
          },
        },
      },
    ]);
  });

  it("stops forwarding after close", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      price: 195.12,
      size: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_trades",
        symbols: ["AAPL"],
      }),
    );

    await session.close();
    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(socket.sentPayloads).toEqual([]);
  });
});
