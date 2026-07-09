import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketSummaryConflator } from "../src/market_summary_conflator.js";
import type { MarketSummary } from "../src/market_data.js";

describe("MarketSummaryConflator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retains only the latest summary for each normalized symbol", async () => {
    const flushedBatches: MarketSummary[][] = [];
    const conflator = new MarketSummaryConflator({
      intervalMs: 250,
      onFlush: (marketSummaries) => {
        flushedBatches.push([...marketSummaries]);
      },
      onError: (error) => {
        throw error;
      },
    });

    conflator.update({
      symbol: " aapl ",
      price: 195.1,
    });

    conflator.update({
      symbol: "AAPL",
      price: 195.2,
    });

    conflator.update({
      symbol: "MSFT",
      price: 420.5,
    });

    await vi.advanceTimersByTimeAsync(250);

    expect(flushedBatches).toEqual([
      [
        {
          symbol: "AAPL",
          price: 195.2,
        },
        {
          symbol: "MSFT",
          price: 420.5,
        },
      ],
    ]);
  });

  it("flushes immediately and cancels the scheduled flush", async () => {
    const flushedBatches: MarketSummary[][] = [];
    const conflator = new MarketSummaryConflator({
      intervalMs: 250,
      onFlush: (marketSummaries) => {
        flushedBatches.push([...marketSummaries]);
      },
      onError: (error) => {
        throw error;
      },
    });

    conflator.update({
      symbol: "AAPL",
      price: 195.1,
    });

    await conflator.flush();
    await vi.advanceTimersByTimeAsync(250);

    expect(flushedBatches).toEqual([
      [
        {
          symbol: "AAPL",
          price: 195.1,
        },
      ],
    ]);
  });

  it("flushes pending summaries before closing", async () => {
    const flushedBatches: MarketSummary[][] = [];
    const conflator = new MarketSummaryConflator({
      intervalMs: 250,
      onFlush: (marketSummaries) => {
        flushedBatches.push([...marketSummaries]);
      },
      onError: (error) => {
        throw error;
      },
    });

    conflator.update({
      symbol: "AAPL",
      price: 195.1,
    });

    await conflator.close();

    expect(flushedBatches).toEqual([
      [
        {
          symbol: "AAPL",
          price: 195.1,
        },
      ],
    ]);

    expect(() => {
      conflator.update({
        symbol: "MSFT",
        price: 420.5,
      });
    }).toThrow("Cannot update a closed conflator.");
  });

  it("reports scheduled flush errors", async () => {
    const error = new Error("flush failed");
    const errors: unknown[] = [];
    const conflator = new MarketSummaryConflator({
      intervalMs: 250,
      onFlush: () => Promise.reject(error),
      onError: (caughtError) => {
        errors.push(caughtError);
      },
    });

    conflator.update({
      symbol: "AAPL",
      price: 195.1,
    });

    await vi.advanceTimersByTimeAsync(250);

    expect(errors).toEqual([error]);
  });

  it("rejects invalid flush intervals", () => {
    expect(() => {
      new MarketSummaryConflator({
        intervalMs: 0,
        onFlush: () => undefined,
        onError: (error) => {
          throw error;
        },
      });
    }).toThrow("intervalMs must be greater than zero.");
  });
});
