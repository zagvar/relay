import type { MarketEvent } from "@zagvar/relay-core";
import { parseAlpacaStockMarketEvents } from "./alpaca_event.js";

/** Minimal upstream socket contract used by the Alpaca client. */
export interface AlpacaWebSocket {
  send(message: string): void | Promise<void>;
  close(): void | Promise<void>;
}

/** Credentials used for Alpaca websocket authentication. */
export interface AlpacaCredentials {
  readonly keyId: string;
  readonly secretKey: string;
}

/** Alpaca stock websocket subscription channels. */
export interface AlpacaStockSubscription {
  readonly trades?: readonly string[];
  readonly quotes?: readonly string[];
  readonly bars?: readonly string[];
  readonly dailyBars?: readonly string[];
  readonly updatedBars?: readonly string[];
}

/** Handles normalized Relay events emitted from Alpaca market data messages. */
export type AlpacaMarketEventHandler = (event: MarketEvent) => void | Promise<void>;

/** Handles runtime errors raised by the Alpaca websocket client. */
export type AlpacaWebSocketErrorHandler = (error: unknown) => void | Promise<void>;

/** Runtime options for `AlpacaStockWebSocketClient`. */
export interface AlpacaStockWebSocketClientOptions {
  readonly socket: AlpacaWebSocket;
  readonly credentials: AlpacaCredentials;
  readonly onMarketEvent: AlpacaMarketEventHandler;
  readonly onError?: AlpacaWebSocketErrorHandler;
}

/** Handles Alpaca stock websocket protocol messages over an injected socket. */
export class AlpacaStockWebSocketClient {
  readonly #socket: AlpacaWebSocket;
  readonly #credentials: AlpacaCredentials;
  readonly #onMarketEvent: AlpacaMarketEventHandler;
  readonly #onError: AlpacaWebSocketErrorHandler | undefined;

  constructor(options: AlpacaStockWebSocketClientOptions) {
    this.#socket = options.socket;
    this.#credentials = options.credentials;
    this.#onMarketEvent = options.onMarketEvent;
    this.#onError = options.onError;
  }

  /** Sends the Alpaca authentication message. */
  async authenticate(): Promise<void> {
    await this.#sendJson({
      action: "auth",
      key: this.#credentials.keyId,
      secret: this.#credentials.secretKey,
    });
  }

  /** Sends an Alpaca subscribe message for stock market data channels. */
  async subscribe(subscription: AlpacaStockSubscription): Promise<void> {
    await this.#sendJson({
      action: "subscribe",
      ...subscription,
    });
  }

  /** Sends an Alpaca unsubscribe message for stock market data channels. */
  async unsubscribe(subscription: AlpacaStockSubscription): Promise<void> {
    await this.#sendJson({
      action: "unsubscribe",
      ...subscription,
    });
  }

  /** Parses one raw Alpaca websocket payload and emits normalized Relay events. */
  async handleMessage(rawMessage: string): Promise<void> {
    try {
      const marketEvents = parseAlpacaStockMarketEvents(rawMessage);

      for (const marketEvent of marketEvents) {
        await this.#onMarketEvent(marketEvent);
      }
    } catch (error: unknown) {
      if (this.#onError !== undefined) {
        await this.#onError(error);
        return;
      }

      throw error;
    }
  }

  /** Closes the underlying websocket. */
  async close(): Promise<void> {
    await Promise.resolve(this.#socket.close());
  }

  async #sendJson(payload: unknown): Promise<void> {
    await Promise.resolve(this.#socket.send(JSON.stringify(payload)));
  }
}
