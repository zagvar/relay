import WebSocket, { type RawData } from "ws";
import {
  AlpacaStockWebSocketClient,
  type AlpacaCredentials,
  type AlpacaMarketEventHandler,
  type AlpacaWebSocket,
  type AlpacaWebSocketErrorHandler,
} from "./alpaca_ws_client.js";

/** Alpaca stock market data feeds supported by this adapter. */
export type AlpacaStockDataFeed = "iex" | "sip" | "delayed_sip" | "test" | "boats" | "overnight";

/** Options for building an Alpaca stock websocket URL. */
export interface AlpacaStockStreamUrlOptions {
  readonly feed: AlpacaStockDataFeed;
  readonly sandbox?: boolean;
  readonly baseUrl?: string;
}

/** Options for creating a Node `ws` Alpaca stock websocket client. */
export interface AlpacaNodeWsStockClientOptions extends AlpacaStockStreamUrlOptions {
  readonly credentials: AlpacaCredentials;
  readonly onMarketEvent: AlpacaMarketEventHandler;
  readonly onError?: AlpacaWebSocketErrorHandler;
  readonly autoAuthenticate?: boolean;
}

/** A live Alpaca stock websocket client backed by Node `ws`. */
export interface AlpacaNodeWsStockClient {
  readonly client: AlpacaStockWebSocketClient;
  readonly websocket: WebSocket;
  close(): Promise<void>;
}

/** Builds the Alpaca stock market data websocket URL. */
export function createAlpacaStockStreamUrl(options: AlpacaStockStreamUrlOptions): string {
  const baseUrl = getAlpacaStockStreamBaseUrl(options).replace(/\/$/, "");

  return `${baseUrl}/${getAlpacaStockFeedVersion(options.feed)}/${options.feed}`;
}

/** Creates a Node `ws` backed Alpaca stock websocket client. */
export function createAlpacaNodeWsStockClient(
  options: AlpacaNodeWsStockClientOptions,
): AlpacaNodeWsStockClient {
  const websocket = new WebSocket(createAlpacaStockStreamUrl(options));
  const client = new AlpacaStockWebSocketClient({
    socket: new NodeWsAlpacaWebSocket(websocket),
    credentials: options.credentials,
    onMarketEvent: options.onMarketEvent,
    ...(options.onError === undefined ? {} : { onError: options.onError }),
  });

  websocket.on("open", () => {
    if (options.autoAuthenticate === false) {
      return;
    }

    void client.authenticate().catch((error: unknown) => {
      reportAlpacaNodeWsError(options.onError, error);
    });
  });

  websocket.on("message", (data, isBinary) => {
    if (isBinary) {
      reportAlpacaNodeWsError(
        options.onError,
        new Error("Alpaca Node ws client only supports text messages."),
      );
      return;
    }

    void client.handleMessage(rawDataToText(data)).catch((error: unknown) => {
      reportAlpacaNodeWsError(options.onError, error);
    });
  });

  websocket.on("error", (error: Error) => {
    reportAlpacaNodeWsError(options.onError, error);
  });

  return {
    client,
    websocket,
    close: () => client.close(),
  };
}

class NodeWsAlpacaWebSocket implements AlpacaWebSocket {
  readonly #websocket: WebSocket;

  constructor(websocket: WebSocket) {
    this.#websocket = websocket;
  }

  send(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#websocket.send(message, (error?: Error | null) => {
        if (error != null) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  close(): Promise<void> {
    if (this.#websocket.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.#websocket.once("close", resolve);
      this.#websocket.close();
    });
  }
}

function getAlpacaStockStreamBaseUrl(options: AlpacaStockStreamUrlOptions): string {
  if (options.baseUrl !== undefined) {
    return options.baseUrl;
  }

  if (options.sandbox === true) {
    return "wss://stream.data.sandbox.alpaca.markets";
  }

  return "wss://stream.data.alpaca.markets";
}

function getAlpacaStockFeedVersion(feed: AlpacaStockDataFeed): string {
  if (feed === "boats" || feed === "overnight") {
    return "v1beta1";
  }

  return "v2";
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

function reportAlpacaNodeWsError(
  onError: AlpacaWebSocketErrorHandler | undefined,
  error: unknown,
): void {
  if (onError === undefined) {
    return;
  }

  void Promise.resolve(onError(error));
}
