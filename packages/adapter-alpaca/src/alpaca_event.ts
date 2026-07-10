import type { MarketEvent } from "@zagvar/relay-core";
import type { AlpacaErrorMessage, AlpacaWebSocketMessage } from "./alpaca_message.js";
import { mapAlpacaStockMarketDataMessage } from "./alpaca_mapper.js";
import {
  isAlpacaErrorMessage,
  isAlpacaStockMarketDataMessage,
  parseAlpacaWebSocketMessageBatch,
} from "./alpaca_parser.js";

/** Error thrown when Alpaca sends a websocket error control message. */
export class AlpacaWebSocketError extends Error {
  readonly code: number;

  constructor(message: AlpacaErrorMessage) {
    super(`Alpaca websocket error ${String(message.code)}: ${message.msg}`);

    this.name = "AlpacaWebSocketError";
    this.code = message.code;
  }
}

/**
 * Parses an Alpaca websocket payload into Relay market events.
 *
 * Control messages such as `success` and `subscription` are ignored.
 * Alpaca error control messages are raised as `AlpacaWebSocketError`.
 */
export function parseAlpacaStockMarketEvents(rawMessage: string): readonly MarketEvent[] {
  return parseAlpacaWebSocketMessageBatch(rawMessage).flatMap((message) =>
    mapAlpacaWebSocketMessageToMarketEvents(message),
  );
}

function mapAlpacaWebSocketMessageToMarketEvents(
  message: AlpacaWebSocketMessage,
): readonly MarketEvent[] {
  if (isAlpacaErrorMessage(message)) {
    throw new AlpacaWebSocketError(message);
  }

  if (isAlpacaStockMarketDataMessage(message)) {
    return [mapAlpacaStockMarketDataMessage(message)];
  }

  return [];
}
