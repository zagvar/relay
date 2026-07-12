import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL } from "../src/event_channel.js";
import { createMarketDataRequestKey } from "../src/symbols.js";
import { MarketDataSubscriptionState, createBarSubscriptionKey } from "../src/subscription.js";

describe("MarketDataSubscriptionState", () => {
  it("tracks channel subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeChannel(MARKET_EVENT_CHANNEL.trade);

    expect(state.hasChannel(MARKET_EVENT_CHANNEL.trade)).toBe(true);
    expect(state.channels).toEqual(["trade"]);

    state.unsubscribeChannel(MARKET_EVENT_CHANNEL.trade);

    expect(state.hasChannel(MARKET_EVENT_CHANNEL.trade)).toBe(false);
  });

  it("tracks normalized market-summary subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeMarketSummaries([" aapl ", "msft"]);

    expect(state.marketSummarySymbols).toEqual(["AAPL", "MSFT"]);
    expect(state.hasMarketSummarySymbol("aapl")).toBe(true);

    state.unsubscribeMarketSummaries(["AAPL"]);

    expect(state.hasMarketSummarySymbol("AAPL")).toBe(false);
    expect(state.hasMarketSummarySymbol("MSFT")).toBe(true);
  });

  it("tracks venue-aware quote subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeQuotes([{ symbol: " aapl ", venue: " nasdaq " }, { symbol: "msft" }]);

    expect(state.quoteKeys).toEqual([
      createMarketDataRequestKey({ symbol: "AAPL", venue: "NASDAQ" }),
      createMarketDataRequestKey({ symbol: "MSFT" }),
    ]);
    expect(state.hasQuoteSubscription({ symbol: "aapl", venue: "nasdaq" })).toBe(true);

    state.unsubscribeQuotes([{ symbol: "AAPL", venue: "NASDAQ" }]);

    expect(state.hasQuoteSubscription({ symbol: "AAPL", venue: "NASDAQ" })).toBe(false);
    expect(state.hasQuoteSubscription({ symbol: "MSFT" })).toBe(true);
  });

  it("tracks venue-aware trade subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeTrades([{ symbol: " aapl ", venue: " nasdaq " }, { symbol: "msft" }]);

    expect(state.tradeKeys).toEqual([
      createMarketDataRequestKey({ symbol: "AAPL", venue: "NASDAQ" }),
      createMarketDataRequestKey({ symbol: "MSFT" }),
    ]);
    expect(state.hasTradeSubscription({ symbol: "aapl", venue: "nasdaq" })).toBe(true);

    state.unsubscribeTrades([{ symbol: "AAPL", venue: "NASDAQ" }]);

    expect(state.hasTradeSubscription({ symbol: "AAPL", venue: "NASDAQ" })).toBe(false);
    expect(state.hasTradeSubscription({ symbol: "MSFT" })).toBe(true);
  });

  it("tracks venue-aware order-book subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeOrderBooks([
      {
        symbol: " btc/usdt ",
        venue: " coinbase ",
      },
      {
        symbol: "BTC/USDT",
        venue: "BINANCE",
      },
    ]);

    expect(state.orderBookKeys).toEqual([
      createMarketDataRequestKey({
        symbol: "BTC/USDT",
        venue: "COINBASE",
      }),
      createMarketDataRequestKey({
        symbol: "BTC/USDT",
        venue: "BINANCE",
      }),
    ]);

    expect(
      state.hasOrderBookSubscription({
        symbol: "btc/usdt",
        venue: "coinbase",
      }),
    ).toBe(true);

    expect(
      state.hasOrderBookSubscription({
        symbol: "BTC/USDT",
      }),
    ).toBe(false);

    state.unsubscribeOrderBooks([
      {
        symbol: "BTC/USDT",
        venue: "COINBASE",
      },
    ]);

    expect(
      state.hasOrderBookSubscription({
        symbol: "BTC/USDT",
        venue: "COINBASE",
      }),
    ).toBe(false);

    expect(
      state.hasOrderBookSubscription({
        symbol: "BTC/USDT",
        venue: "BINANCE",
      }),
    ).toBe(true);
  });

  it("tracks normalized bar subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeBars({ symbol: " aapl ", timeframe: "1Min" });

    expect(state.barKeys).toEqual([
      JSON.stringify([createMarketDataRequestKey({ symbol: "AAPL" }), "1Min"]),
    ]);
    expect(state.hasBarSubscription({ symbol: "AAPL", timeframe: "1Min" })).toBe(true);

    state.unsubscribeBars({ symbol: "aapl", timeframe: "1Min" });

    expect(state.hasBarSubscription({ symbol: "AAPL", timeframe: "1Min" })).toBe(false);
  });

  it("clears all subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeChannel(MARKET_EVENT_CHANNEL.trade);
    state.subscribeMarketSummaries(["AAPL"]);
    state.subscribeQuotes([{ symbol: "AAPL" }]);
    state.subscribeTrades([{ symbol: "AAPL" }]);
    state.subscribeOrderBooks([
      {
        symbol: "BTC/USDT",
        venue: "COINBASE",
      },
    ]);
    state.subscribeBars({ symbol: "AAPL", timeframe: "1Min" });

    state.clear();

    expect(state.channels).toEqual([]);
    expect(state.marketSummarySymbols).toEqual([]);
    expect(state.quoteKeys).toEqual([]);
    expect(state.tradeKeys).toEqual([]);
    expect(state.orderBookKeys).toEqual([]);
    expect(state.barKeys).toEqual([]);
  });
});

describe("createBarSubscriptionKey", () => {
  it("creates normalized bar subscription keys", () => {
    expect(createBarSubscriptionKey({ symbol: " aapl ", timeframe: "1Min" })).toBe(
      JSON.stringify([createMarketDataRequestKey({ symbol: "AAPL" }), "1Min"]),
    );
  });
});
