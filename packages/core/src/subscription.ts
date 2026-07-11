import type { MarketEventChannel } from "./event_channel.js";
import type { BarsRequest, MarketDataRequest } from "./market_data.js";
import {
  createMarketDataRequestKey,
  normalizeSymbol,
} from "./symbols.js";

/** Identifies a cached or live bar stream for one symbol and timeframe. */
export type BarSubscription = BarsRequest;

/** Tracks one client's market data subscriptions. */
export class MarketDataSubscriptionState {
  readonly #channels = new Set<MarketEventChannel>();
  readonly #marketSummarySymbols = new Set<string>();
  readonly #quoteKeys = new Set<string>();
  readonly #tradeKeys = new Set<string>();
  readonly #barKeys = new Set<string>();

  /** Returns subscribed channels in insertion order. */
  get channels(): readonly MarketEventChannel[] {
    return [...this.#channels];
  }

  /** Returns subscribed market-summary symbols. */
  get marketSummarySymbols(): readonly string[] {
    return [...this.#marketSummarySymbols];
  }

  /** Returns subscribed quote symbols in insertion order. */
  get quoteKeys(): readonly string[] {
    return [...this.#quoteKeys];
  }

  /** Returns subscribed trade symbols in insertion order. */
  get tradeKeys(): readonly string[] {
    return [...this.#tradeKeys];
  }

  /** Returns subscribed bar keys in insertion order. */
  get barKeys(): readonly string[] {
    return [...this.#barKeys];
  }

  /** Adds a channel subscription. */
  subscribeChannel(channel: MarketEventChannel): void {
    this.#channels.add(channel);
  }

  /** Removes a channel subscription. */
  unsubscribeChannel(channel: MarketEventChannel): void {
    this.#channels.delete(channel);
  }

  /** Returns true when this client is subscribed to a channel. */
  hasChannel(channel: MarketEventChannel): boolean {
    return this.#channels.has(channel);
  }

  /** Adds market-summary subscriptions. */
  subscribeMarketSummaries(symbols: readonly string[]): void {
    for (const symbol of symbols) {
      this.#marketSummarySymbols.add(normalizeSymbol(symbol));
    }
  }

  /** Removes market-summary subscriptions. */
  unsubscribeMarketSummaries(symbols: readonly string[]): void {
    for (const symbol of symbols) {
      this.#marketSummarySymbols.delete(normalizeSymbol(symbol));
    }
  }

  /** Returns true when subscribed to a symbol's market summary. */
  hasMarketSummarySymbol(symbol: string): boolean {
    return this.#marketSummarySymbols.has(normalizeSymbol(symbol));
  }

  /** Adds quote subscriptions for the provided symbols. */
  subscribeQuotes(requests: readonly MarketDataRequest[]): void {
    for (const request of requests) {
      this.#quoteKeys.add(createMarketDataRequestKey(request));
    }
  }

  /** Removes quote subscriptions for the provided symbols. */
  unsubscribeQuotes(requests: readonly MarketDataRequest[]): void {
    for (const request of requests) {
      this.#quoteKeys.delete(createMarketDataRequestKey(request));
    }
  }

  /** Returns true when subscribed to quotes for a symbol. */
  hasQuoteSubscription(request: MarketDataRequest): boolean {
    return this.#quoteKeys.has(createMarketDataRequestKey(request));
  }

  /** Adds trade subscriptions for the provided symbols. */
  subscribeTrades(requests: readonly MarketDataRequest[]): void {
    for (const request of requests) {
      this.#tradeKeys.add(createMarketDataRequestKey(request));
    }
  }

  /** Removes trade subscriptions for the provided symbols. */
  unsubscribeTrades(requests: readonly MarketDataRequest[]): void {
    for (const request of requests) {
      this.#tradeKeys.delete(createMarketDataRequestKey(request));
    }
  }

  /** Returns true when this client is subscribed to trades for a symbol. */
  hasTradeSubscription(request: MarketDataRequest): boolean {
    return this.#tradeKeys.has(createMarketDataRequestKey(request));
  }

  /** Adds a bar subscription. */
  subscribeBars(subscription: BarSubscription): void {
    this.#barKeys.add(createBarSubscriptionKey(subscription));
  }

  /** Removes a bar subscription. */
  unsubscribeBars(subscription: BarSubscription): void {
    this.#barKeys.delete(createBarSubscriptionKey(subscription));
  }

  /** Returns true when this client is subscribed to bars for a symbol/timeframe pair. */
  hasBarSubscription(subscription: BarSubscription): boolean {
    return this.#barKeys.has(createBarSubscriptionKey(subscription));
  }

  /** Removes all subscriptions. */
  clear(): void {
    this.#channels.clear();
    this.#marketSummarySymbols.clear();
    this.#quoteKeys.clear();
    this.#tradeKeys.clear();
    this.#barKeys.clear();
  }
}

/** Creates a stable key for bar subscriptions. */
export function createBarSubscriptionKey(subscription: BarSubscription): string {
  return JSON.stringify([
    createMarketDataRequestKey(subscription),
    subscription.timeframe,
  ]);
}
