import type {
  BarsRequest,
  MarketBar,
  MarketClock,
  MarketEvent,
  MarketSummary,
} from "./market_data.js";
import type { ProviderCapabilities } from "./provider_capability.js";

/** Receives normalized live market events from a provider connection. */
export type MarketEventHandler = (event: MarketEvent) => void | Promise<void>;

/** Represents an active live market data connection. */
export interface LiveMarketConnection {
  /** Subscribes the connection to provider-supported symbols. */
  subscribe(symbols: readonly string[]): Promise<void>;

  /** Removes symbols from the active provider subscription. */
  unsubscribe(symbols: readonly string[]): Promise<void>;

  /** Closes the connection and releases any underlying resources. */
  close(): Promise<void>;
}

/** Options used when opening a live provider connection. */
export interface LiveConnectionOptions {
  readonly symbols: readonly string[];
  readonly onEvent: MarketEventHandler;
  readonly onError?: (error: Error) => void;
}

/** Provider-neutral contract implemented by market data adapters. */
export interface MarketDataProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /** Returns latest marketSummaries keyed by normalized symbol. */
  getMarketSummaries(symbols: readonly string[]): Promise<Readonly<Record<string, MarketSummary>>>;

  /** Returns historical bars for a symbol and timeframe. */
  getBars(request: BarsRequest): Promise<readonly MarketBar[]>;

  /** Returns market clock data when supported by the provider. */
  getMarketClock?(): Promise<MarketClock>;

  /** Opens a live market data stream when supported by the provider. */
  connectLive?(options: LiveConnectionOptions): Promise<LiveMarketConnection>;
}
