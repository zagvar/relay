import type { LosslessNumber } from "lossless-json";
import { isLosslessNumber, parse as parseLosslessJson } from "lossless-json";
import type {
  AlpacaControlMessage,
  AlpacaErrorMessage,
  AlpacaStockBarMessage,
  AlpacaStockMarketDataMessage,
  AlpacaStockQuoteMessage,
  AlpacaStockTradeMessage,
  AlpacaSubscriptionMessage,
  AlpacaSuccessMessage,
  AlpacaWebSocketMessage,
} from "./alpaca_message.js";

/** Parses one Alpaca websocket JSON array payload. */
export function parseAlpacaWebSocketMessageBatch(
  rawMessage: string,
): readonly AlpacaWebSocketMessage[] {
  const value: unknown = parseLosslessJson(rawMessage);

  if (!Array.isArray(value)) {
    throw new Error("Expected Alpaca websocket payload to be an array.");
  }

  return value.map(parseAlpacaWebSocketMessage);
}

/** Parses one already-decoded Alpaca websocket message. */
export function parseAlpacaWebSocketMessage(value: unknown): AlpacaWebSocketMessage {
  if (isAlpacaWebSocketMessage(value)) {
    return value;
  }

  throw new Error("Unsupported Alpaca websocket message.");
}

/** Returns true when the value is an Alpaca message understood by this adapter. */
export function isAlpacaWebSocketMessage(value: unknown): value is AlpacaWebSocketMessage {
  return isAlpacaControlMessage(value) || isAlpacaStockMarketDataMessage(value);
}

/** Returns true when the value is an Alpaca control message. */
export function isAlpacaControlMessage(value: unknown): value is AlpacaControlMessage {
  return (
    isAlpacaSuccessMessage(value) ||
    isAlpacaErrorMessage(value) ||
    isAlpacaSubscriptionMessage(value)
  );
}

/** Returns true when the value is an Alpaca stock market data message. */
export function isAlpacaStockMarketDataMessage(
  value: unknown,
): value is AlpacaStockMarketDataMessage {
  return (
    isAlpacaStockTradeMessage(value) ||
    isAlpacaStockQuoteMessage(value) ||
    isAlpacaStockBarMessage(value)
  );
}

/** Returns true when the value is an Alpaca success control message. */
export function isAlpacaSuccessMessage(value: unknown): value is AlpacaSuccessMessage {
  return isRecord(value) && value.T === "success" && typeof value.msg === "string";
}

/** Returns true when the value is an Alpaca error control message. */
export function isAlpacaErrorMessage(value: unknown): value is AlpacaErrorMessage {
  return (
    isRecord(value) &&
    value.T === "error" &&
    isLosslessNumber(value.code) &&
    typeof value.msg === "string"
  );
}

/** Returns true when the value is an Alpaca subscription state message. */
export function isAlpacaSubscriptionMessage(value: unknown): value is AlpacaSubscriptionMessage {
  return (
    isRecord(value) &&
    value.T === "subscription" &&
    isOptionalStringArray(value.trades) &&
    isOptionalStringArray(value.quotes) &&
    isOptionalStringArray(value.bars) &&
    isOptionalStringArray(value.updatedBars) &&
    isOptionalStringArray(value.dailyBars) &&
    isOptionalStringArray(value.statuses) &&
    isOptionalStringArray(value.lulds) &&
    isOptionalStringArray(value.corrections) &&
    isOptionalStringArray(value.cancelErrors)
  );
}

/** Returns true when the value is an Alpaca stock trade message. */
export function isAlpacaStockTradeMessage(value: unknown): value is AlpacaStockTradeMessage {
  return (
    isRecord(value) &&
    value.T === "t" &&
    typeof value.S === "string" &&
    isLosslessNumber(value.i) &&
    typeof value.x === "string" &&
    isLosslessNumber(value.p) &&
    isLosslessNumber(value.s) &&
    isStringArray(value.c) &&
    typeof value.t === "string" &&
    typeof value.z === "string"
  );
}

/** Returns true when the value is an Alpaca stock quote message. */
export function isAlpacaStockQuoteMessage(value: unknown): value is AlpacaStockQuoteMessage {
  return (
    isRecord(value) &&
    value.T === "q" &&
    typeof value.S === "string" &&
    typeof value.ax === "string" &&
    isLosslessNumber(value.ap) &&
    isLosslessNumber(value.as) &&
    typeof value.bx === "string" &&
    isLosslessNumber(value.bp) &&
    isLosslessNumber(value.bs) &&
    isStringArray(value.c) &&
    typeof value.t === "string" &&
    typeof value.z === "string"
  );
}

/** Returns true when the value is an Alpaca stock bar message. */
export function isAlpacaStockBarMessage(value: unknown): value is AlpacaStockBarMessage {
  return (
    isRecord(value) &&
    (value.T === "b" || value.T === "d" || value.T === "u") &&
    typeof value.S === "string" &&
    isLosslessNumber(value.o) &&
    isLosslessNumber(value.h) &&
    isLosslessNumber(value.l) &&
    isLosslessNumber(value.c) &&
    isLosslessNumber(value.v) &&
    isOptionalLosslessNumber(value.vw) &&
    isOptionalLosslessNumber(value.n) &&
    typeof value.t === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalStringArray(value: unknown): value is readonly string[] | undefined {
  return value === undefined || isStringArray(value);
}

function isOptionalLosslessNumber(value: unknown): value is LosslessNumber | undefined {
  return value === undefined || isLosslessNumber(value);
}
