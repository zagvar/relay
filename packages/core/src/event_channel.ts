/** Stable channel names used by Relay transports and storage adapters. */
export const MARKET_EVENT_CHANNEL = {
  trade: "trade",
  quote: "quote",
  bar: "bar",
  orderBook: "order_book",
  marketSummary: "market_summary",
  marketClock: "market_clock",
} as const;

/** A stable channel name used to route normalized market data. */
export type MarketEventChannel = (typeof MARKET_EVENT_CHANNEL)[keyof typeof MARKET_EVENT_CHANNEL];

/** A transport-neutral message moved through Relay. */
export interface RelayMessage<TData> {
  readonly channel: MarketEventChannel;
  readonly data: TData;
}

/** Creates a transport-neutral Relay message. */
export function createRelayMessage<TData>(
  channel: MarketEventChannel,
  data: TData,
): RelayMessage<TData> {
  return { channel, data };
}
