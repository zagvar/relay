import { describe, expect, it } from "vitest";
import {
  applyOrderBookUpdate,
  type OrderBookSnapshot,
  type OrderBookUpdate,
} from "../src/index.js";

const snapshot: OrderBookSnapshot = {
  type: "order_book_snapshot",
  symbol: "BTC/USDT",
  assetClass: "crypto",
  venue: "DEMO_EXCHANGE",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  bids: [
    { price: 100, quantity: 2 },
    { price: 99, quantity: 3 },
  ],
  asks: [
    { price: 101, quantity: 1 },
    { price: 102, quantity: 4 },
  ],
  timestamp: "2026-01-01T14:30:00.000Z",
  sequence: 10,
};

describe("applyOrderBookUpdate", () => {
  it("inserts, replaces, removes, and sorts levels", () => {
    const result = applyOrderBookUpdate(
      snapshot,
      createUpdate({
        bids: [
          { price: 100.25, quantity: 1 },
          { price: 100, quantity: 5 },
          { price: 99, quantity: 0 },
        ],
        asks: [
          { price: 100.5, quantity: 2 },
          { price: 102, quantity: 0 },
        ],
      }),
    );

    expect(result).toEqual({
      applied: true,
      snapshot: {
        ...snapshot,
        bids: [
          { price: 100.25, quantity: 1 },
          { price: 100, quantity: 5 },
        ],
        asks: [
          { price: 100.5, quantity: 2 },
          { price: 101, quantity: 1 },
        ],
        timestamp: "2026-01-01T14:30:01.000Z",
        sequence: 11,
      },
    });
  });

  it("replaces both sides for reset updates", () => {
    const result = applyOrderBookUpdate(
      snapshot,
      createUpdate({
        reset: true,
        bids: [{ price: 95, quantity: 10 }],
        asks: [{ price: 105, quantity: 12 }],
      }),
    );

    expect(result).toEqual({
      applied: true,
      snapshot: {
        ...snapshot,
        bids: [{ price: 95, quantity: 10 }],
        asks: [{ price: 105, quantity: 12 }],
        timestamp: "2026-01-01T14:30:01.000Z",
        sequence: 11,
      },
    });
  });

  it("rejects stale and discontinuous sequences", () => {
    expect(applyOrderBookUpdate(snapshot, createUpdate({ sequence: 10 }))).toEqual({
      applied: false,
      reason: "stale_sequence",
    });

    expect(applyOrderBookUpdate(snapshot, createUpdate({ previousSequence: 9 }))).toEqual({
      applied: false,
      reason: "sequence_gap",
    });
  });

  it("rejects an update from a different venue", () => {
    expect(applyOrderBookUpdate(snapshot, createUpdate({ venue: "OTHER_EXCHANGE" }))).toEqual({
      applied: false,
      reason: "instrument_mismatch",
    });
  });

  it("preserves the current sequence when an update omits one", () => {
    const updateWithoutSequence: OrderBookUpdate = {
      type: "order_book_update",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "DEMO_EXCHANGE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: [],
      asks: [],
      timestamp: "2026-01-01T14:30:01.000Z",
      previousSequence: 10,
      reset: false,
    };

    const result = applyOrderBookUpdate(snapshot, updateWithoutSequence);

    expect(result).toEqual({
      applied: true,
      snapshot: {
        ...snapshot,
        timestamp: "2026-01-01T14:30:01.000Z",
      },
    });
  });

  it("caps retained depth on each side", () => {
    const result = applyOrderBookUpdate(
      snapshot,
      createUpdate({
        bids: [{ price: 100.25, quantity: 1 }],
        asks: [{ price: 100.5, quantity: 1 }],
      }),
      { depth: 2 },
    );

    expect(result).toEqual({
      applied: true,
      snapshot: {
        ...snapshot,
        bids: [
          { price: 100.25, quantity: 1 },
          { price: 100, quantity: 2 },
        ],
        asks: [
          { price: 100.5, quantity: 1 },
          { price: 101, quantity: 1 },
        ],
        timestamp: "2026-01-01T14:30:01.000Z",
        sequence: 11,
      },
    });
  });

  it("rejects invalid depth limits", () => {
    expect(() =>
      applyOrderBookUpdate(snapshot, createUpdate(), {
        depth: 0,
      }),
    ).toThrow("depth must be a positive integer.");
  });
});

function createUpdate(overrides: Partial<OrderBookUpdate> = {}): OrderBookUpdate {
  return {
    type: "order_book_update",
    symbol: "BTC/USDT",
    assetClass: "crypto",
    venue: "DEMO_EXCHANGE",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    bids: [],
    asks: [],
    timestamp: "2026-01-01T14:30:01.000Z",
    sequence: 11,
    previousSequence: 10,
    reset: false,
    ...overrides,
  };
}
