import { describe, expect, it } from "vitest";
import type { MarketEvent } from "@zagvar/relay-core";
import { AlpacaStockWebSocketClient, AlpacaWebSocketError } from "../src/index.js";
import type { AlpacaWebSocket } from "../src/index.js";

class FakeAlpacaWebSocket implements AlpacaWebSocket {
  readonly sentMessages: string[] = [];
  closed = false;

  send(message: string): void {
    this.sentMessages.push(message);
  }

  close(): void {
    this.closed = true;
  }

  get sentPayloads(): unknown[] {
    return this.sentMessages.map((message) => JSON.parse(message) as unknown);
  }
}

describe("AlpacaStockWebSocketClient", () => {
  it("sends authentication messages", async () => {
    const socket = new FakeAlpacaWebSocket();
    const client = new AlpacaStockWebSocketClient({
      socket,
      credentials: {
        keyId: "test-key",
        secretKey: "test-secret",
      },
      onMarketEvent: () => undefined,
    });

    await client.authenticate();

    expect(socket.sentPayloads).toEqual([
      {
        action: "auth",
        key: "test-key",
        secret: "test-secret",
      },
    ]);
  });

  it("sends subscribe messages", async () => {
    const socket = new FakeAlpacaWebSocket();
    const client = new AlpacaStockWebSocketClient({
      socket,
      credentials: {
        keyId: "test-key",
        secretKey: "test-secret",
      },
      onMarketEvent: () => undefined,
    });

    await client.subscribe({
      trades: ["AAPL"],
      quotes: ["AAPL", "MSFT"],
      bars: ["SPY"],
    });

    expect(socket.sentPayloads).toEqual([
      {
        action: "subscribe",
        trades: ["AAPL"],
        quotes: ["AAPL", "MSFT"],
        bars: ["SPY"],
      },
    ]);
  });

  it("sends unsubscribe messages", async () => {
    const socket = new FakeAlpacaWebSocket();
    const client = new AlpacaStockWebSocketClient({
      socket,
      credentials: {
        keyId: "test-key",
        secretKey: "test-secret",
      },
      onMarketEvent: () => undefined,
    });

    await client.unsubscribe({
      trades: ["AAPL"],
    });

    expect(socket.sentPayloads).toEqual([
      {
        action: "unsubscribe",
        trades: ["AAPL"],
      },
    ]);
  });

  it("emits normalized Relay events from Alpaca messages", async () => {
    const socket = new FakeAlpacaWebSocket();
    const marketEvents: MarketEvent[] = [];
    const client = new AlpacaStockWebSocketClient({
      socket,
      credentials: {
        keyId: "test-key",
        secretKey: "test-secret",
      },
      onMarketEvent: (event) => {
        marketEvents.push(event);
      },
    });

    await client.handleMessage(
      JSON.stringify([
        {
          T: "t",
          i: 96921,
          S: "aapl",
          x: "D",
          p: 126.55,
          s: 1,
          t: "2021-02-22T15:51:44.208Z",
          c: ["@", "I"],
          z: "C",
        },
      ]),
    );

    expect(marketEvents).toEqual([
      {
        type: "trade",
        symbol: "AAPL",
        assetClass: "equity",
        quoteAsset: "USD",
        venue: "D",
        providerTradeId: "96921",
        price: "126.55",
        quantity: "1",
        timestamp: "2021-02-22T15:51:44.208Z",
      },
    ]);
  });

  it("passes Alpaca errors to the configured error handler", async () => {
    const socket = new FakeAlpacaWebSocket();
    const errors: unknown[] = [];
    const client = new AlpacaStockWebSocketClient({
      socket,
      credentials: {
        keyId: "test-key",
        secretKey: "test-secret",
      },
      onMarketEvent: () => undefined,
      onError: (error) => {
        errors.push(error);
      },
    });

    await client.handleMessage(
      JSON.stringify([
        {
          T: "error",
          code: 406,
          msg: "connection limit exceeded",
        },
      ]),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(AlpacaWebSocketError);
  });

  it("closes the underlying socket", async () => {
    const socket = new FakeAlpacaWebSocket();
    const client = new AlpacaStockWebSocketClient({
      socket,
      credentials: {
        keyId: "test-key",
        secretKey: "test-secret",
      },
      onMarketEvent: () => undefined,
    });

    await client.close();

    expect(socket.closed).toBe(true);
  });
});
