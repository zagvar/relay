import type { MarketEventChannel } from "./event_channel.js";
import { normalizeSymbol } from "./symbols.js";

/** Identifies a cached or live bar stream for one symbol and timeframe. */
export interface BarSubscription {
  readonly symbol: string;
  readonly timeframe: string;
}

/** Tracks one client's market data subscriptions. */
export class MarketDataSubscriptionState {
  readonly #channels = new Set<MarketEventChannel>();
  readonly #quoteSymbols = new Set<string>();
  readonly #tradeSymbols = new Set<string>();
  readonly #barKeys = new Set<string>();

  /** Returns subscribed channels in insertion order. */
  get channels(): readonly MarketEventChannel[] {
    return [...this.#channels];
  }

  /** Returns subscribed quote symbols in insertion order. */
  get quoteSymbols(): readonly string[] {
    return [...this.#quoteSymbols];
  }

  /** Returns subscribed trade symbols in insertion order. */
  get tradeSymbols(): readonly string[] {
    return [...this.#tradeSymbols];
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

  /** Adds quote subscriptions for the provided symbols. */
  subscribeQuotes(symbols: readonly string[]): void {
    for (const symbol of symbols) {
      this.#quoteSymbols.add(normalizeSymbol(symbol));
    }
  }

  /** Removes quote subscriptions for the provided symbols. */
  unsubscribeQuotes(symbols: readonly string[]): void {
    for (const symbol of symbols) {
      this.#quoteSymbols.delete(normalizeSymbol(symbol));
    }
  }

  /** Returns true when subscribed to quotes for a symbol. */
  hasQuoteSymbol(symbol: string): boolean {
    return this.#quoteSymbols.has(normalizeSymbol(symbol));
  }

  /** Adds trade subscriptions for the provided symbols. */
  subscribeTrades(symbols: readonly string[]): void {
    for (const symbol of symbols) {
      this.#tradeSymbols.add(normalizeSymbol(symbol));
    }
  }

  /** Removes trade subscriptions for the provided symbols. */
  unsubscribeTrades(symbols: readonly string[]): void {
    for (const symbol of symbols) {
      this.#tradeSymbols.delete(normalizeSymbol(symbol));
    }
  }

  /** Returns true when this client is subscribed to trades for a symbol. */
  hasTradeSymbol(symbol: string): boolean {
    return this.#tradeSymbols.has(normalizeSymbol(symbol));
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
    this.#quoteSymbols.clear();
    this.#tradeSymbols.clear();
    this.#barKeys.clear();
  }
}

/** Creates a stable key for bar subscriptions. */
export function createBarSubscriptionKey(subscription: BarSubscription): string {
  return `${normalizeSymbol(subscription.symbol)}:${subscription.timeframe}`;
}
