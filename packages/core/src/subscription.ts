import type { MarketEventChannel } from "./event_channel.js";
import type { BarsRequest, MarketDataRequest } from "./market_data.js";
import { createMarketDataRequestKey, normalizeSymbol } from "./symbols.js";

/** Identifies a cached or live bar stream for one symbol and timeframe. */
export type BarSubscription = BarsRequest;

/** Tracks one client's market data subscriptions. */
export class MarketDataSubscriptionState {
  readonly #channels = new Set<MarketEventChannel>();
  readonly #marketSummarySymbols = new Set<string>();
  readonly #quoteKeys = new Set<string>();
  readonly #tradeKeys = new Set<string>();
  readonly #orderBookKeys = new Set<string>();
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

  /** Returns subscribed order-book keys in insertion order. */
  get orderBookKeys(): readonly string[] {
    return [...this.#orderBookKeys];
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

  /** Adds quote subscriptions for the provided requests. */
  subscribeQuotes(requests: readonly MarketDataRequest[]): void {
    addMarketDataRequests(this.#quoteKeys, requests);
  }

  /** Removes quote subscriptions for the provided requests. */
  unsubscribeQuotes(requests: readonly MarketDataRequest[]): void {
    removeMarketDataRequests(this.#quoteKeys, requests);
  }

  /** Returns true when subscribed to quotes for a request. */
  hasQuoteSubscription(request: MarketDataRequest): boolean {
    return hasMarketDataRequest(this.#quoteKeys, request);
  }

  /** Adds trade subscriptions for the provided requests. */
  subscribeTrades(requests: readonly MarketDataRequest[]): void {
    addMarketDataRequests(this.#tradeKeys, requests);
  }

  /** Removes trade subscriptions for the provided requests. */
  unsubscribeTrades(requests: readonly MarketDataRequest[]): void {
    removeMarketDataRequests(this.#tradeKeys, requests);
  }

  /** Returns true when subscribed to trades for a request. */
  hasTradeSubscription(request: MarketDataRequest): boolean {
    return hasMarketDataRequest(this.#tradeKeys, request);
  }

  /** Adds venue-aware order-book subscriptions. */
  subscribeOrderBooks(requests: readonly MarketDataRequest[]): void {
    addMarketDataRequests(this.#orderBookKeys, requests);
  }

  /** Removes venue-aware order-book subscriptions. */
  unsubscribeOrderBooks(requests: readonly MarketDataRequest[]): void {
    removeMarketDataRequests(this.#orderBookKeys, requests);
  }

  /** Returns true when subscribed to an order book. */
  hasOrderBookSubscription(request: MarketDataRequest): boolean {
    return hasMarketDataRequest(this.#orderBookKeys, request);
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
    this.#orderBookKeys.clear();
    this.#barKeys.clear();
  }
}

function addMarketDataRequests(keys: Set<string>, requests: readonly MarketDataRequest[]): void {
  for (const request of requests) {
    keys.add(createMarketDataRequestKey(request));
  }
}

function removeMarketDataRequests(keys: Set<string>, requests: readonly MarketDataRequest[]): void {
  for (const request of requests) {
    keys.delete(createMarketDataRequestKey(request));
  }
}

function hasMarketDataRequest(keys: ReadonlySet<string>, request: MarketDataRequest): boolean {
  return keys.has(createMarketDataRequestKey(request));
}

/** Creates a stable key for bar subscriptions. */
export function createBarSubscriptionKey(subscription: BarSubscription): string {
  return JSON.stringify([createMarketDataRequestKey(subscription), subscription.timeframe]);
}
