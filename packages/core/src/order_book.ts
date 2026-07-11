import type { MarketDataRequest, MarketIdentity } from "./market_data.js";

/**
 * One aggregated order-book price level.
 *
 * `quantity` is the total resting quantity at `price`, not an individual
 * order.
 */
export interface OrderBookLevel {
  readonly price: number;
  readonly quantity: number;
  readonly orderCount?: number;
}

/**
 * One changed order-book price level.
 *
 * A quantity of zero removes the level from locally maintained state.
 */
export interface OrderBookUpdateLevel {
  readonly price: number;
  readonly quantity: number;
  readonly orderCount?: number;
}

/**
 * Identifies one venue-specific order book.
 *
 * `venue` may be omitted when the application intentionally maintains one
 * consolidated or provider-default book for the symbol.
 */
export type OrderBookRequest = MarketDataRequest;

/**
 * A complete provider-neutral order-book state.
 *
 * Bids are ordered from highest to lowest price. Asks are ordered from lowest
 * to highest price.
 */
export interface OrderBookSnapshot extends MarketIdentity {
  readonly type: "order_book_snapshot";
  readonly bids: readonly OrderBookLevel[];
  readonly asks: readonly OrderBookLevel[];
  readonly timestamp: string;
  readonly sequence?: number;
}

/**
 * A provider-neutral batch of changed order-book levels.
 *
 * Positive quantity inserts or replaces a level. Zero quantity removes it.
 * Providers without sequence continuity may omit the sequence fields.
 */
export interface OrderBookUpdate extends MarketIdentity {
  readonly type: "order_book_update";
  readonly bids: readonly OrderBookUpdateLevel[];
  readonly asks: readonly OrderBookUpdateLevel[];
  readonly timestamp: string;
  readonly sequence?: number;
  readonly previousSequence?: number;

  /**
   * Treat the update levels as a complete replacement rather than an
   * incremental change.
   */
  readonly reset: boolean;
}

/** Any normalized order-book event Relay can transport. */
export type OrderBookEvent = OrderBookSnapshot | OrderBookUpdate;
