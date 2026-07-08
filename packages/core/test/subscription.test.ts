import { describe, expect, it } from "vitest";
import { MARKET_EVENT_CHANNEL } from "../src/event_channel.js";
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

  it("tracks normalized trade symbol subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeTrades([" aapl ", "msft"]);

    expect(state.tradeSymbols).toEqual(["AAPL", "MSFT"]);
    expect(state.hasTradeSymbol("aapl")).toBe(true);

    state.unsubscribeTrades(["AAPL"]);

    expect(state.hasTradeSymbol("AAPL")).toBe(false);
    expect(state.hasTradeSymbol("MSFT")).toBe(true);
  });

  it("tracks normalized bar subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeBars({ symbol: " aapl ", timeframe: "1Min" });

    expect(state.barKeys).toEqual(["AAPL:1Min"]);
    expect(state.hasBarSubscription({ symbol: "AAPL", timeframe: "1Min" })).toBe(true);

    state.unsubscribeBars({ symbol: "aapl", timeframe: "1Min" });

    expect(state.hasBarSubscription({ symbol: "AAPL", timeframe: "1Min" })).toBe(false);
  });

  it("clears all subscriptions", () => {
    const state = new MarketDataSubscriptionState();

    state.subscribeChannel(MARKET_EVENT_CHANNEL.trade);
    state.subscribeTrades(["AAPL"]);
    state.subscribeBars({ symbol: "AAPL", timeframe: "1Min" });

    state.clear();

    expect(state.channels).toEqual([]);
    expect(state.tradeSymbols).toEqual([]);
    expect(state.barKeys).toEqual([]);
  });
});

describe("createBarSubscriptionKey", () => {
  it("creates normalized bar subscription keys", () => {
    expect(createBarSubscriptionKey({ symbol: " aapl ", timeframe: "1Min" })).toBe("AAPL:1Min");
  });
});
