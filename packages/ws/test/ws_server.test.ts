import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  MARKET_EVENT_CHANNEL,
  MemoryRelayEventBus,
  createRelayMessage,
  type MarketTrade,
} from "@zagvar/relay-core";
import WebSocket from "ws";
import { attachRelayNodeWsConnection, createRelayNodeWsServer } from "../src/ws_server.js";
import { RELAY_CLIENT_MESSAGE_MAX_BYTES } from "../src/client_message.js";

class FakeWsWebSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  readonly sentMessages: string[] = [];
  readonly closeEvents: { code: number | undefined; reason: string | undefined }[] = [];

  send(data: WebSocket.Data, callback?: (error?: Error) => void): void {
    this.sentMessages.push(webSocketDataToText(data));
    callback?.();
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    this.closeEvents.push({ code, reason });
    this.emit("close", code ?? 1000, Buffer.from(reason ?? ""));
  }

  receiveText(message: string): void {
    this.emit("message", Buffer.from(message), false);
  }

  receiveBinary(message: string): void {
    this.emit("message", Buffer.from(message), true);
  }

  get sentPayloads(): unknown[] {
    return this.sentMessages.map((message) => JSON.parse(message) as unknown);
  }

  get websocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}

describe("attachRelayNodeWsConnection", () => {
  it("forwards subscribed relay messages over a ws-compatible socket", async () => {
    const eventBus = new MemoryRelayEventBus();
    const websocket = new FakeWsWebSocket();

    await attachRelayNodeWsConnection({
      websocket: websocket.websocket,
      eventBus,
    });

    websocket.receiveText(
      JSON.stringify({
        type: "subscribe_trades",
        trades: [{ symbol: "AAPL" }],
      }),
    );
    await waitForMessageHandling();

    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      assetClass: "equity",
      price: "195.12",
      quantity: "100",
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(websocket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "trade",
          data: trade,
        },
      },
    ]);
  });

  it("closes binary client messages", async () => {
    const eventBus = new MemoryRelayEventBus();
    const websocket = new FakeWsWebSocket();

    await attachRelayNodeWsConnection({
      websocket: websocket.websocket,
      eventBus,
    });

    websocket.receiveBinary("not-json");

    expect(websocket.closeEvents).toEqual([
      {
        code: 1003,
        reason: "Relay only accepts text messages.",
      },
    ]);
  });

  it("enforces the configured connection subscription limit", async () => {
    const eventBus = new MemoryRelayEventBus();
    const websocket = new FakeWsWebSocket();

    await attachRelayNodeWsConnection({
      websocket: websocket.websocket,
      eventBus,
      maxSubscriptions: 1,
    });

    websocket.receiveText(
      JSON.stringify({
        type: "subscribe_trades",
        trades: [{ symbol: "AAPL" }],
      }),
    );

    await waitForMessageHandling();

    websocket.receiveText(
      JSON.stringify({
        type: "subscribe_trades",
        trades: [{ symbol: "MSFT" }],
      }),
    );

    await waitForMessageHandling();

    expect(websocket.closeEvents).toEqual([
      {
        code: 1008,
        reason: "Invalid Relay client message.",
      },
    ]);
  });
});

describe("createRelayNodeWsServer", () => {
  it("creates a ws server with the safe default payload limit", () => {
    const eventBus = new MemoryRelayEventBus();
    const server = createRelayNodeWsServer({
      noServer: true,
      eventBus,
    });

    expect(server.options.noServer).toBe(true);
    expect(server.options.maxPayload).toBe(RELAY_CLIENT_MESSAGE_MAX_BYTES);

    server.close();
  });

  it("allows a smaller configured payload limit", () => {
    const eventBus = new MemoryRelayEventBus();
    const server = createRelayNodeWsServer({
      noServer: true,
      eventBus,
      maxPayload: 16 * 1024,
    });

    expect(server.options.maxPayload).toBe(16 * 1024);

    server.close();
  });

  it.each([0, -1, 1.5, RELAY_CLIENT_MESSAGE_MAX_BYTES + 1])(
    "rejects invalid maxPayload %s",
    (maxPayload) => {
      const eventBus = new MemoryRelayEventBus();

      expect(() =>
        createRelayNodeWsServer({
          noServer: true,
          eventBus,
          maxPayload,
        }),
      ).toThrow(RangeError);
    },
  );

  it("accepts a per-connection subscription limit", () => {
    const eventBus = new MemoryRelayEventBus();
    const server = createRelayNodeWsServer({
      noServer: true,
      eventBus,
      maxSubscriptions: 100,
    });

    server.close();
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects invalid server maxSubscriptions %s",
    (maxSubscriptions) => {
      const eventBus = new MemoryRelayEventBus();

      expect(() =>
        createRelayNodeWsServer({
          noServer: true,
          eventBus,
          maxSubscriptions,
        }),
      ).toThrow(RangeError);
    },
  );

  it("accepts a per-connection outbound buffer limit", () => {
    const eventBus = new MemoryRelayEventBus();
    const server = createRelayNodeWsServer({
      noServer: true,
      eventBus,
      maxBufferedBytes: 512 * 1024,
    });

    server.close();
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects invalid server maxBufferedBytes %s",
    (maxBufferedBytes) => {
      const eventBus = new MemoryRelayEventBus();

      expect(() =>
        createRelayNodeWsServer({
          noServer: true,
          eventBus,
          maxBufferedBytes,
        }),
      ).toThrow(RangeError);
    },
  );
});

function waitForMessageHandling(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function webSocketDataToText(data: WebSocket.Data): string {
  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  return data.toString("utf8");
}
