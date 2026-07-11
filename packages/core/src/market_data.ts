import type { OrderBookEvent } from "./order_book.js";

/** A broad asset class supported by market data providers. */
export type AssetClass =
  "equity" | "crypto" | "fx" | "commodity" | "index" | "fund" | "option" | "future" | "other";

/**
 * Provider-neutral identity shared by Relay market-data contracts.
 *
 * `assetClass` describes the instrument's economic exposure.
 * `venue` identifies where its market data or trading activity originates.
 * Pair-based instruments may also provide `baseAsset` and `quoteAsset`.
 */
export interface MarketIdentity {
  readonly symbol: string;
  readonly assetClass: AssetClass;
  readonly venue?: string;
  readonly baseAsset?: string;
  readonly quoteAsset?: string;
}

/** Identifies one symbol and optional venue in cache and subscription APIs. */
export interface MarketDataRequest {
  readonly symbol: string;
  readonly venue?: string;
}

/** A normalized latest trade event from a market data provider. */
export interface MarketTrade extends MarketIdentity {
  readonly type: "trade";
  readonly price: number;
  readonly quantity: number;
  readonly timestamp: string;
  readonly providerTradeId?: string;
}

/** A normalized best bid and offer update. */
export interface MarketQuote extends MarketIdentity {
  readonly type: "quote";
  readonly bidPrice: number;
  readonly bidQuantity: number;
  readonly askPrice: number;
  readonly askQuantity: number;
  readonly timestamp: string;

  /**
   * Venues currently contributing the best bid and ask.
   *
   * These may differ from the identity-level `venue` when the quote is
   * consolidated across multiple venues.
   */
  readonly bidVenue?: string;
  readonly askVenue?: string;
}

/** A normalized OHLCV bar. */
export interface MarketBar extends MarketIdentity {
  readonly type: "bar";
  readonly timeframe: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly timestamp: string;
  readonly tradeCount?: number;
  readonly volumeWeightedAveragePrice?: number;
}

/**
 * Consolidated current market state for an instrument.
 *
 * Suitable for watchlists, market tables, and portfolio displays.
 */
export interface MarketSummary extends MarketIdentity {
  readonly price: number;
  readonly timestamp?: string;
  readonly quantity?: number;
  readonly open?: number;
  readonly high?: number;
  readonly low?: number;
  readonly previousClose?: number;
  readonly volume?: number;
  readonly previousVolume?: number;
  readonly change?: number;
  readonly changePercent?: number;
  readonly bidPrice?: number;
  readonly bidQuantity?: number;
  readonly askPrice?: number;
  readonly askQuantity?: number;
}

/** A normalized exchange or venue clock. */
export interface MarketClock {
  readonly isOpen: boolean;
  readonly timestamp: string;
  readonly nextOpen?: string;
  readonly nextClose?: string;
}

/** Request parameters for historical bars. */
export interface BarsRequest extends MarketDataRequest {
  readonly timeframe: string;
  readonly start?: string;
  readonly end?: string;
  readonly limit?: number;
}

/** Any normalized market event Relay can move through a transport. */
export type MarketEvent = MarketTrade | MarketQuote | MarketBar | OrderBookEvent;
