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
        symbols: ["AAPL"],
      }),
    );
    await waitForMessageHandling();

    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      price: 195.12,
      size: 100,
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
});

describe("createRelayNodeWsServer", () => {
  it("creates a ws server without binding when noServer is enabled", () => {
    const eventBus = new MemoryRelayEventBus();
    const server = createRelayNodeWsServer({
      noServer: true,
      eventBus,
    });

    expect(server.options.noServer).toBe(true);

    server.close();
  });
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
