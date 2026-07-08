/** A normalized tradable market symbol */
export interface MarketSymbol {
  readonly symbol: string;
  readonly exchange?: string;
  readonly currency?: string;
}

/** A normalized latest trade event from a market data provider. */
export interface MarketTrade {
  readonly type: "trade";
  readonly symbol: string;
  readonly price: number;
  readonly size: number;
  readonly timestamp: string;
  readonly exchange?: string;
  readonly providerTradeId?: string;
}

/** A normalized OHLCV bar. */
export interface MarketBar {
  readonly type: "bar";
  readonly symbol: string;
  readonly timeframe: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly timestamp: string;
  readonly tradeCount?: number;
  readonly volumeWeightedAveragePrice?: string;
}

/** A normalized market snapshot suitable for initial client hydration. */
export interface MarketSnapshot {
  readonly symbol: string;
  readonly price: number;
  readonly size?: number;
  readonly timestamp?: string;
  readonly open?: number;
  readonly high?: number;
  readonly low?: number;
  readonly close?: number;
  readonly volume?: number;
  readonly previousClose?: number;
  readonly previousVolume?: number;
}

/** A normalized exchange or venue clock. */
export interface MarketClock {
  readonly isOpen: boolean;
  readonly timestamp: string;
  readonly nextOpen?: string;
  readonly nextClose?: string;
}

/** Request parameters for historical bars. */
export interface BarsRequest {
  readonly symbol: string;
  readonly timeframe: string;
  readonly start?: string;
  readonly end?: string;
  readonly limit?: number;
}

/** Any normalized market event Relay can move through a transport. */
export type MarketEvent = MarketTrade | MarketBar;
