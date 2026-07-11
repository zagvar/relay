import { describe, expect, it } from "vitest";
import type { OrderBookEvent, OrderBookSnapshot, OrderBookUpdate } from "../src/index.js";

const snapshot: OrderBookSnapshot = {
  type: "order_book_snapshot",
  symbol: "BTC/USDT",
  assetClass: "crypto",
  venue: "DEMO_EXCHANGE",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  bids: [
    { price: 65_000, quantity: 1.25 },
    { price: 64_999.5, quantity: 0.8 },
  ],
  asks: [
    { price: 65_000.5, quantity: 0.6 },
    { price: 65_001, quantity: 1.1 },
  ],
  timestamp: "2026-01-01T14:30:00.000Z",
  sequence: 100,
};

describe("order-book contracts", () => {
  it("represents a complete provider-neutral snapshot", () => {
    expect(snapshot.type).toBe("order_book_snapshot");
    expect(snapshot.bids[0]).toEqual({
      price: 65_000,
      quantity: 1.25,
    });
    expect(snapshot.asks[0]).toEqual({
      price: 65_000.5,
      quantity: 0.6,
    });
  });

  it("represents incremental changes and level removals", () => {
    const update: OrderBookUpdate = {
      type: "order_book_update",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "DEMO_EXCHANGE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: [
        { price: 65_000, quantity: 0 },
        { price: 65_000.25, quantity: 0.5 },
      ],
      asks: [{ price: 65_000.5, quantity: 0.4 }],
      timestamp: "2026-01-01T14:30:01.000Z",
      sequence: 101,
      previousSequence: 100,
      reset: false,
    };

    expect(update.bids[0]?.quantity).toBe(0);
    expect(update.previousSequence).toBe(snapshot.sequence);
  });

  it("narrows snapshots and updates through the type discriminator", () => {
    const event: OrderBookEvent = snapshot;

    expect(event.sequence).toBe(100);
  });
});
