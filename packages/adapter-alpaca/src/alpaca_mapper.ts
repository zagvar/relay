import type { DecimalString } from "@zagvar/decimal";
import {
  marketBarSchema,
  marketQuoteSchema,
  marketTradeSchema,
  normalizeSymbol,
  type MarketBar,
  type MarketEvent,
  type MarketQuote,
  type MarketTrade,
} from "@zagvar/relay-core";
import {
  multiplyNonNegativeDecimal,
  toNonNegativeDecimal,
  toPositiveDecimal,
  toSafeNonNegativeInteger,
} from "./alpaca_number.js";
import type {
  AlpacaStockBarMessage,
  AlpacaStockMarketDataMessage,
  AlpacaStockQuoteMessage,
  AlpacaStockTradeMessage,
} from "./alpaca_message.js";

/**
 * Alpaca stock quote sizes are reported in round lots.
 *
 * For US equities, one round lot is conventionally 100 shares. This applies to
 * displayed quote liquidity, not broker order sizing or fractional trading.
 *
 * Example: `bs: 3` means 300 shares are displayed at the bid price.
 */
export const ALPACA_STOCK_QUOTE_LOT_SIZE: DecimalString = "100";

/** Maps an Alpaca stock trade message to a Relay trade event. */
export function mapAlpacaStockTrade(message: AlpacaStockTradeMessage): MarketTrade {
  return marketTradeSchema.parse({
    type: "trade",
    symbol: normalizeSymbol(message.S),
    assetClass: "equity",
    quoteAsset: "USD",
    venue: message.x,
    providerTradeId: message.i.toString(),
    price: toPositiveDecimal(message.p),
    quantity: toPositiveDecimal(message.s),
    timestamp: message.t,
  });
}

/** Maps an Alpaca stock quote message to a Relay quote event. */
export function mapAlpacaStockQuote(message: AlpacaStockQuoteMessage): MarketQuote {
  return marketQuoteSchema.parse({
    type: "quote",
    symbol: normalizeSymbol(message.S),
    assetClass: "equity",
    quoteAsset: "USD",
    bidVenue: message.bx,
    askVenue: message.ax,
    bidPrice: toPositiveDecimal(message.bp),
    bidQuantity: multiplyNonNegativeDecimal(message.bs, ALPACA_STOCK_QUOTE_LOT_SIZE),
    askPrice: toPositiveDecimal(message.ap),
    askQuantity: multiplyNonNegativeDecimal(message.as, ALPACA_STOCK_QUOTE_LOT_SIZE),
    timestamp: message.t,
  });
}

/** Maps an Alpaca stock bar message to a Relay bar event. */
export function mapAlpacaStockBar(message: AlpacaStockBarMessage): MarketBar {
  return marketBarSchema.parse({
    type: "bar",
    symbol: normalizeSymbol(message.S),
    assetClass: "equity",
    quoteAsset: "USD",
    timeframe: getAlpacaStockBarTimeframe(message),
    open: toPositiveDecimal(message.o),
    high: toPositiveDecimal(message.h),
    low: toPositiveDecimal(message.l),
    close: toPositiveDecimal(message.c),
    volume: toNonNegativeDecimal(message.v),
    timestamp: message.t,
    ...(message.n === undefined
      ? {}
      : { tradeCount: toSafeNonNegativeInteger(message.n, "Alpaca bar trade count") }),
    ...(message.vw === undefined
      ? {}
      : { volumeWeightedAveragePrice: toPositiveDecimal(message.vw) }),
  });
}

/** Maps an Alpaca stock market data message to the matching Relay event. */
export function mapAlpacaStockMarketDataMessage(
  message: AlpacaStockMarketDataMessage,
): MarketEvent {
  switch (message.T) {
    case "t":
      return mapAlpacaStockTrade(message);
    case "q":
      return mapAlpacaStockQuote(message);
    case "b":
    case "u":
    case "d":
      return mapAlpacaStockBar(message);
  }
}

function getAlpacaStockBarTimeframe(message: AlpacaStockBarMessage): string {
  if (message.T === "d") {
    return "1Day";
  }

  return "1Min";
}
