import type { LosslessNumber } from "lossless-json";

/** Alpaca stock trade message from the market data websocket. */
export interface AlpacaStockTradeMessage {
  readonly T: "t";
  readonly S: string;
  readonly i: LosslessNumber;
  readonly x: string;
  readonly p: LosslessNumber;
  readonly s: LosslessNumber;
  readonly c: readonly string[];
  readonly t: string;
  readonly z: string;
}

/** Alpaca stock quote message from the market data websocket. */
export interface AlpacaStockQuoteMessage {
  readonly T: "q";
  readonly S: string;
  readonly ax: string;
  readonly ap: LosslessNumber;
  readonly as: LosslessNumber;
  readonly bx: string;
  readonly bp: LosslessNumber;
  readonly bs: LosslessNumber;
  readonly c: readonly string[];
  readonly t: string;
  readonly z: string;
}

/** Alpaca stock bar-like message from the market data websocket. */
export interface AlpacaStockBarMessage {
  readonly T: "b" | "d" | "u";
  readonly S: string;
  readonly o: LosslessNumber;
  readonly h: LosslessNumber;
  readonly l: LosslessNumber;
  readonly c: LosslessNumber;
  readonly v: LosslessNumber;
  readonly vw?: LosslessNumber;
  readonly n?: LosslessNumber;
  readonly t: string;
}

/** Market data messages currently mapped by this adapter. */
export type AlpacaStockMarketDataMessage =
  AlpacaStockTradeMessage | AlpacaStockQuoteMessage | AlpacaStockBarMessage;

/** Alpaca websocket success control message. */
export interface AlpacaSuccessMessage {
  readonly T: "success";
  readonly msg: string;
}

/** Alpaca websocket error control message. */
export interface AlpacaErrorMessage {
  readonly T: "error";
  readonly code: LosslessNumber;
  readonly msg: string;
}

/** Alpaca websocket subscription state message. */
export interface AlpacaSubscriptionMessage {
  readonly T: "subscription";
  readonly trades?: readonly string[];
  readonly quotes?: readonly string[];
  readonly bars?: readonly string[];
  readonly updatedBars?: readonly string[];
  readonly dailyBars?: readonly string[];
  readonly statuses?: readonly string[];
  readonly lulds?: readonly string[];
  readonly corrections?: readonly string[];
  readonly cancelErrors?: readonly string[];
}

/** Alpaca websocket control messages currently handled by this adapter. */
export type AlpacaControlMessage =
  AlpacaSuccessMessage | AlpacaErrorMessage | AlpacaSubscriptionMessage;

/** Any Alpaca websocket message currently understood by this adapter. */
export type AlpacaWebSocketMessage = AlpacaControlMessage | AlpacaStockMarketDataMessage;
