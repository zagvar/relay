import type {
  BarsHydrationRequest,
  MarketDataHydrationRequest,
  MarketDataRequest,
  MarketEventChannel,
  OrderBookRequest,
} from "@zagvar/relay-core";
import { isRecord, isStringArray } from "./type_guards.js";

/** Client message sent over a Relay WebSocket connection. */
export type RelayClientMessage =
  | SubscribeChannelsMessage
  | UnsubscribeChannelsMessage
  | SubscribeMarketSummariesMessage
  | UnsubscribeMarketSummariesMessage
  | SubscribeQuotesMessage
  | UnsubscribeQuotesMessage
  | SubscribeTradesMessage
  | UnsubscribeTradesMessage
  | SubscribeBarsMessage
  | UnsubscribeBarsMessage
  | HydrateMessage;

/** Subscribes the client to one or more event channels. */
export interface SubscribeChannelsMessage {
  readonly type: "subscribe_channels";
  readonly channels: readonly MarketEventChannel[];
}

/** Unsubscribes the client from one or more event channels. */
export interface UnsubscribeChannelsMessage {
  readonly type: "unsubscribe_channels";
  readonly channels: readonly MarketEventChannel[];
}

/** Subscribes the client to live market summaries. */
export interface SubscribeMarketSummariesMessage {
  readonly type: "subscribe_market_summaries";
  readonly symbols: readonly string[];
}

/** Unsubscribes the client from live market summaries. */
export interface UnsubscribeMarketSummariesMessage {
  readonly type: "unsubscribe_market_summaries";
  readonly symbols: readonly string[];
}

/** Subscribes the client to live quotes for symbols. */
export interface SubscribeQuotesMessage {
  readonly type: "subscribe_quotes";
  readonly quotes: readonly MarketDataRequest[];
}

/** Unsubscribes the client from live quotes for symbols. */
export interface UnsubscribeQuotesMessage {
  readonly type: "unsubscribe_quotes";
  readonly quotes: readonly MarketDataRequest[];
}

/** Subscribes the client to live trades for symbols. */
export interface SubscribeTradesMessage {
  readonly type: "subscribe_trades";
  readonly trades: readonly MarketDataRequest[];
}

/** Unsubscribes the client from live trades for symbols. */
export interface UnsubscribeTradesMessage {
  readonly type: "unsubscribe_trades";
  readonly trades: readonly MarketDataRequest[];
}

/** Subscribes the client to live bars. */
export interface SubscribeBarsMessage {
  readonly type: "subscribe_bars";
  readonly bars: readonly BarsHydrationRequest[];
}

/** Unsubscribes the client from live bars. */
export interface UnsubscribeBarsMessage {
  readonly type: "unsubscribe_bars";
  readonly bars: readonly BarsHydrationRequest[];
}

/** Requests an initial hydration payload. */
export interface HydrateMessage {
  readonly type: "hydrate";
  readonly request: MarketDataHydrationRequest;
}

/** Parses a raw WebSocket payload into a Relay client message. */
export function parseRelayClientMessage(rawMessage: string): RelayClientMessage {
  const parsedMessage: unknown = JSON.parse(rawMessage);

  if (!isRecord(parsedMessage)) {
    throw new Error("Client message must be an object.");
  }

  switch (parsedMessage.type) {
    case "subscribe_channels":
    case "unsubscribe_channels":
      return parseChannelsMessage(parsedMessage);
    case "subscribe_market_summaries":
    case "unsubscribe_market_summaries":
      return parseSymbolsMessage(parsedMessage);
    case "subscribe_quotes":
    case "unsubscribe_quotes":
      return parseMarketDataRequestsMessage(parsedMessage, "quotes");
    case "subscribe_trades":
    case "unsubscribe_trades":
      return parseMarketDataRequestsMessage(parsedMessage, "trades");
    case "subscribe_bars":
    case "unsubscribe_bars":
      return parseBarsMessage(parsedMessage);
    case "hydrate":
      return parseHydrateMessage(parsedMessage);
    default:
      throw new Error("Unsupported client message type.");
  }
}

function parseChannelsMessage(
  message: Record<string, unknown>,
): SubscribeChannelsMessage | UnsubscribeChannelsMessage {
  if (!Array.isArray(message.channels)) {
    throw new Error("Client message channels must be an array.");
  }

  return {
    type: message.type as "subscribe_channels" | "unsubscribe_channels",
    channels: message.channels as readonly MarketEventChannel[],
  };
}

function parseSymbolsMessage(
  message: Record<string, unknown>,
): SubscribeMarketSummariesMessage | UnsubscribeMarketSummariesMessage {
  if (!isStringArray(message.symbols)) {
    throw new Error("Client message symbols must be an array of strings.");
  }

  return {
    type: message.type as
      | "subscribe_market_summaries"
      | "unsubscribe_market_summaries",
    symbols: message.symbols,
  };
}

function parseMarketDataRequestsMessage(
  message: Record<string, unknown>,
  field: "quotes" | "trades",
):
  | SubscribeQuotesMessage
  | UnsubscribeQuotesMessage
  | SubscribeTradesMessage
  | UnsubscribeTradesMessage {
  const requests = message[field];

  if (!Array.isArray(requests) || !requests.every(isMarketDataRequest)) {
    throw new Error(`Client message ${field} must be an array of market data requests.`);
  }

  if (field === "quotes") {
    return {
      type: message.type as "subscribe_quotes" | "unsubscribe_quotes",
      quotes: requests,
    };
  }

  return {
    type: message.type as "subscribe_trades" | "unsubscribe_trades",
    trades: requests,
  };
}

function parseBarsMessage(
  message: Record<string, unknown>,
): SubscribeBarsMessage | UnsubscribeBarsMessage {
  if (!Array.isArray(message.bars) || !message.bars.every(isBarsHydrationRequest)) {
    throw new Error("Client message bars must be an array of bar requests.");
  }

  return {
    type: message.type as "subscribe_bars" | "unsubscribe_bars",
    bars: message.bars,
  };
}

function parseHydrateMessage(message: Record<string, unknown>): HydrateMessage {
  if (!isMarketDataHydrationRequest(message.request)) {
    throw new Error("Client message request must be a hydration request.");
  }

  return {
    type: "hydrate",
    request: message.request,
  };
}

function isBarsHydrationRequest(value: unknown): value is BarsHydrationRequest {
  return isRecord(value) && isMarketDataRequest(value) && typeof value.timeframe === "string";
}

function isMarketDataRequest(value: unknown): value is MarketDataRequest {
  return (
    isRecord(value) &&
    typeof value.symbol === "string" &&
    (value.venue === undefined || typeof value.venue === "string")
  );
}

function isOrderBookRequest(value: unknown): value is OrderBookRequest {
  return isMarketDataRequest(value);
}

function isMarketDataHydrationRequest(value: unknown): value is MarketDataHydrationRequest {
  if (!isRecord(value)) {
    return false;
  }

  if (value.symbols !== undefined && !isStringArray(value.symbols)) {
    return false;
  }

  if (value.bars !== undefined) {
    if (!Array.isArray(value.bars) || !value.bars.every(isBarsHydrationRequest)) {
      return false;
    }
  }

  if (value.quotes !== undefined) {
    if (!Array.isArray(value.quotes) || !value.quotes.every(isMarketDataRequest)) {
      return false;
    }
  }

  if (value.trades !== undefined) {
    if (!Array.isArray(value.trades) || !value.trades.every(isMarketDataRequest)) {
      return false;
    }
  }

  if (value.orderBooks !== undefined) {
    if (!Array.isArray(value.orderBooks) || !value.orderBooks.every(isOrderBookRequest)) {
      return false;
    }
  }

  if (
    value.includeMarketSummaries !== undefined &&
    typeof value.includeMarketSummaries !== "boolean"
  ) {
    return false;
  }

  if (value.includeMarketClock !== undefined && typeof value.includeMarketClock !== "boolean") {
    return false;
  }

  return true;
}
