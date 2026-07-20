export type { DecimalString, SignedDecimalString } from "@zagvar/decimal";

// Market data contracts
export type {
  AssetClass,
  BarsRequest,
  MarketBar,
  MarketClock,
  MarketDataRequest,
  MarketIdentity,
  MarketQuote,
  MarketSummary,
  MarketTrade,
} from "./market_data.js";
export {
  assetClassSchema,
  barsRequestSchema,
  isoTimestampSchema,
  marketBarSchema,
  marketClockSchema,
  marketDataRequestSchema,
  marketIdentifierSchema,
  marketIdentitySchema,
  marketQuoteSchema,
  marketSummarySchema,
  marketTradeSchema,
  timeframeSchema,
} from "./market_data.js";

export { marketEventSchema } from "./market_event.js";

export type { MarketEvent } from "./market_event.js";

// Order-book contracts and reconciliation
export type {
  OrderBookEvent,
  OrderBookLevel,
  OrderBookSnapshot,
  OrderBookUpdate,
  OrderBookUpdateLevel,
} from "./order_book.js";
export {
  MAX_ORDER_BOOK_LEVELS_PER_SIDE,
  orderBookEventSchema,
  orderBookLevelSchema,
  orderBookSnapshotSchema,
  orderBookUpdateLevelSchema,
  orderBookUpdateSchema,
} from "./order_book.js";

export { applyOrderBookUpdate } from "./order_book_reducer.js";

export type {
  ApplyOrderBookUpdateOptions,
  OrderBookUpdateFailure,
  OrderBookUpdateResult,
} from "./order_book_reducer.js";

// Provider contracts and capabilities
export type {
  LiveConnectionOptions,
  LiveMarketConnection,
  MarketDataProvider,
  MarketEventHandler,
} from "./provider.js";

export {
  PROVIDER_CAPABILITY,
  assertProviderCapability,
  hasProviderCapability,
} from "./provider_capability.js";

export type { ProviderCapabilities, ProviderCapability } from "./provider_capability.js";

// Events and subscriptions
export {
  MARKET_EVENT_CHANNEL,
  createRelayMessage,
  marketEventChannelSchema,
  parseRelayMessage,
  relayMessageSchema,
} from "./event_channel.js";

export type {
  MarketEventChannel,
  RelayMessage,
  RelayMessageDataByChannel,
} from "./event_channel.js";

export { MemoryRelayEventBus } from "./event_bus.js";

export type { RelayEventBus, RelayMessageHandler, Unsubscribe } from "./event_bus.js";

export { MarketDataSubscriptionState, createBarSubscriptionKey } from "./subscription.js";

export type { BarSubscription } from "./subscription.js";

// Cache, hydration, and processing
export {
  MAX_MARKET_SUMMARIES_PER_BATCH,
  MemoryMarketDataCache,
  marketSummaryBatchSchema,
} from "./market_data_cache.js";

export type { MarketDataCache } from "./market_data_cache.js";

export { MarketDataHydrator, marketDataHydrationRequestSchema } from "./market_data_hydration.js";

export type {
  BarsHydrationRequest,
  MarketDataHydration,
  MarketDataHydrationRequest,
} from "./market_data_hydration.js";

export { MarketDataPipeline, OrderBookPipelineError } from "./market_data_pipeline.js";

export type {
  MarketDataPipelineOptions,
  OrderBookPipelineErrorCode,
} from "./market_data_pipeline.js";

export { MarketSummaryConflator } from "./market_summary_conflator.js";

export type {
  MarketSummaryBatchHandler,
  MarketSummaryConflatorOptions,
} from "./market_summary_conflator.js";

// Utilities
export {
  chunkSymbols,
  createMarketDataRequestKey,
  normalizeSymbol,
  normalizeVenue,
} from "./symbols.js";

export { calculateReconnectDelay } from "./reconnect.js";

export type { ReconnectBackoffOptions } from "./reconnect.js";

export { EventThrottle } from "./throttle.js";
