import type { MarketDataHydrator, RelayEventBus } from "@zagvar/relay-core";
import WebSocket, { WebSocketServer, type RawData, type ServerOptions } from "ws";
import {
  RelayClientSession,
  resolveRelayClientMaxBufferedBytes,
  resolveRelayClientMaxSubscriptions,
  type RelayClientSessionOptions,
} from "./client_session.js";
import type { RelaySocket } from "./socket.js";
import { RELAY_CLIENT_MESSAGE_MAX_BYTES } from "./client_message.js";

/** Handles runtime errors produced by a Relay Node `ws` connection. */
export type RelayNodeWsErrorHandler = (error: unknown) => void;

/** Options for attaching Relay behavior to one Node `ws` connection. */
export interface AttachRelayNodeWsConnectionOptions {
  readonly websocket: WebSocket;
  readonly eventBus: RelayEventBus;
  readonly hydrator?: MarketDataHydrator;
  readonly onError?: RelayNodeWsErrorHandler;
  /** Maximum cumulative subscriptions retained by this connection. */
  readonly maxSubscriptions?: number;
  /** Maximum outbound bytes queued per connection. */
  readonly maxBufferedBytes?: number;
}

/** Options for creating a Relay-backed Node `ws` server. */
export interface RelayNodeWsServerOptions extends ServerOptions {
  readonly eventBus: RelayEventBus;
  readonly hydrator?: MarketDataHydrator;
  readonly onError?: RelayNodeWsErrorHandler;
  /** Maximum cumulative subscriptions retained by each connection. */
  readonly maxSubscriptions?: number;
  /** Maximum outbound bytes queued per connection. */
  readonly maxBufferedBytes?: number;
}

class WsRelaySocket implements RelaySocket {
  readonly #websocket: WebSocket;

  constructor(websocket: WebSocket) {
    this.#websocket = websocket;
  }

  get bufferedAmount(): number {
    return this.#websocket.bufferedAmount;
  }

  send(message: string): Promise<void> {
    if (this.#websocket.readyState !== WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.#websocket.send(message, (error?: Error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  close(code?: number, reason?: string): void {
    if (
      this.#websocket.readyState === WebSocket.CLOSING ||
      this.#websocket.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    this.#websocket.close(code, reason);
  }
}

/** Attaches Relay session handling to one Node `ws` connection. */
export async function attachRelayNodeWsConnection(
  options: AttachRelayNodeWsConnectionOptions,
): Promise<RelayClientSession> {
  const session = new RelayClientSession(createSessionOptions(options));

  await session.start();

  options.websocket.on("message", (data, isBinary) => {
    if (isBinary) {
      options.websocket.close(1003, "Relay only accepts text messages.");
      return;
    }

    void session.handleMessage(rawDataToText(data)).catch((error: unknown) => {
      options.onError?.(error);
      options.websocket.close(1008, "Invalid Relay client message.");
    });
  });

  options.websocket.on("close", () => {
    void session.close().catch((error: unknown) => {
      options.onError?.(error);
    });
  });

  options.websocket.on("error", (error: Error) => {
    options.onError?.(error);
  });

  return session;
}

/** Creates a Node `ws` server that starts a Relay session for every connection. */
export function createRelayNodeWsServer(options: RelayNodeWsServerOptions): WebSocketServer {
  const {
    eventBus,
    hydrator,
    onError,
    maxPayload: configuredMaxPayload,
    maxSubscriptions: configuredMaxSubscriptions,
    maxBufferedBytes: configuredMaxBufferedBytes,
    ...serverOptions
  } = options;

  const maxPayload = resolveMaxPayload(configuredMaxPayload);

  const maxSubscriptions = resolveRelayClientMaxSubscriptions(configuredMaxSubscriptions);

  const maxBufferedBytes = resolveRelayClientMaxBufferedBytes(configuredMaxBufferedBytes);

  const server = new WebSocketServer({
    ...serverOptions,
    maxPayload,
  });

  server.on("connection", (websocket) => {
    void attachRelayNodeWsConnection({
      websocket,
      eventBus,
      maxSubscriptions,
      maxBufferedBytes,
      ...(hydrator === undefined ? {} : { hydrator }),
      ...(onError === undefined ? {} : { onError }),
    }).catch((error: unknown) => {
      onError?.(error);
      websocket.close(1011, "Relay session failed.");
    });
  });

  server.on("error", (error: Error) => {
    onError?.(error);
  });

  return server;
}

function createSessionOptions(
  options: AttachRelayNodeWsConnectionOptions,
): RelayClientSessionOptions {
  const socket = new WsRelaySocket(options.websocket);

  return {
    socket,
    eventBus: options.eventBus,
    ...(options.hydrator === undefined ? {} : { hydrator: options.hydrator }),
    ...(options.maxSubscriptions === undefined
      ? {}
      : {
          maxSubscriptions: options.maxSubscriptions,
        }),
    ...(options.maxBufferedBytes === undefined
      ? {}
      : {
          maxBufferedBytes: options.maxBufferedBytes,
        }),
    ...(options.onError === undefined ? {} : { onError: options.onError }),
  };
}

function rawDataToText(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  return data.toString("utf8");
}

function resolveMaxPayload(configuredMaxPayload: number | undefined): number {
  const maxPayload = configuredMaxPayload ?? RELAY_CLIENT_MESSAGE_MAX_BYTES;

  if (
    !Number.isSafeInteger(maxPayload) ||
    maxPayload <= 0 ||
    maxPayload > RELAY_CLIENT_MESSAGE_MAX_BYTES
  ) {
    throw new RangeError(
      `maxPayload must be a positive safe integer no greater than ${String(
        RELAY_CLIENT_MESSAGE_MAX_BYTES,
      )}.`,
    );
  }

  return maxPayload;
}
