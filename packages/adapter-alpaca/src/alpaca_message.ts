/** Alpaca stock trade message from the market data websocket. */
export interface AlpacaStockTradeMessage {
  readonly T: "t";
  readonly S: string;
  readonly i: number;
  readonly x: string;
  readonly p: number;
  readonly s: number;
  readonly c: readonly string[];
  readonly t: string;
  readonly z: string;
}

/** Alpaca stock quote message from the market data websocket. */
export interface AlpacaStockQuoteMessage {
  readonly T: "q";
  readonly S: string;
  readonly ax: string;
  readonly ap: number;
  readonly as: number;
  readonly bx: string;
  readonly bp: number;
  readonly bs: number;
  readonly c: readonly string[];
  readonly t: string;
  readonly z: string;
}

/** Alpaca stock bar-like message from the market data websocket. */
export interface AlpacaStockBarMessage {
  readonly T: "b" | "d" | "u";
  readonly S: string;
  readonly o: number;
  readonly h: number;
  readonly l: number;
  readonly c: number;
  readonly v: number;
  readonly vw?: number;
  readonly n?: number;
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
  readonly code: number;
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
