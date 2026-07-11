import type { MarketBar, MarketEvent, MarketQuote, MarketTrade } from "@zagvar/relay-core";
import { normalizeSymbol } from "@zagvar/relay-core";
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
export const ALPACA_STOCK_QUOTE_LOT_SIZE = 100;

/** Maps an Alpaca stock trade message to a Relay trade event. */
export function mapAlpacaStockTrade(message: AlpacaStockTradeMessage): MarketTrade {
  return {
    type: "trade",
    symbol: normalizeSymbol(message.S),
    assetClass: "equity",
    quoteAsset: "USD",
    venue: message.x,
    providerTradeId: String(message.i),
    price: message.p,
    quantity: message.s,
    timestamp: message.t,
  };
}

/** Maps an Alpaca stock quote message to a Relay quote event. */
export function mapAlpacaStockQuote(message: AlpacaStockQuoteMessage): MarketQuote {
  return {
    type: "quote",
    symbol: normalizeSymbol(message.S),
    assetClass: "equity",
    quoteAsset: "USD",
    bidVenue: message.bx,
    askVenue: message.ax,
    bidPrice: message.bp,
    bidQuantity: message.bs * ALPACA_STOCK_QUOTE_LOT_SIZE,
    askPrice: message.ap,
    askQuantity: message.as * ALPACA_STOCK_QUOTE_LOT_SIZE,
    timestamp: message.t,
  };
}

/** Maps an Alpaca stock bar message to a Relay bar event. */
export function mapAlpacaStockBar(message: AlpacaStockBarMessage): MarketBar {
  return {
    type: "bar",
    symbol: normalizeSymbol(message.S),
    assetClass: "equity",
    quoteAsset: "USD",
    timeframe: getAlpacaStockBarTimeframe(message),
    open: message.o,
    high: message.h,
    low: message.l,
    close: message.c,
    volume: message.v,
    timestamp: message.t,
    ...(message.n === undefined ? {} : { tradeCount: message.n }),
    ...(message.vw === undefined ? {} : { volumeWeightedAveragePrice: message.vw }),
  };
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
