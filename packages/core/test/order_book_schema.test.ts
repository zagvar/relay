import { describe, expect, it } from "vitest";
import {
  marketEventSchema,
  orderBookEventSchema,
  orderBookSnapshotSchema,
  orderBookUpdateSchema,
} from "../src/index.js";

const validSnapshot = {
  type: "order_book_snapshot",
  symbol: "BTC/USD",
  assetClass: "crypto",
  venue: "COINBASE",
  baseAsset: "BTC",
  quoteAsset: "USD",
  bids: [
    {
      price: "65000",
      quantity: "1.25",
      orderCount: 4,
    },
  ],
  asks: [
    {
      price: "65001",
      quantity: "0.8",
      orderCount: 2,
    },
  ],
  timestamp: "2026-07-20T01:00:00Z",
  sequence: 100,
} as const;

const validUpdate = {
  type: "order_book_update",
  symbol: "BTC/USD",
  assetClass: "crypto",
  venue: "COINBASE",
  baseAsset: "BTC",
  quoteAsset: "USD",
  bids: [
    {
      price: "65000",
      quantity: "2",
      orderCount: 5,
    },
  ],
  asks: [
    {
      price: "65001",
      quantity: "0",
      orderCount: 0,
    },
  ],
  timestamp: "2026-07-20T01:00:01Z",
  sequence: 101,
  previousSequence: 100,
  reset: false,
} as const;

describe("order-book runtime schemas", () => {
  it("parses canonical snapshots and updates", () => {
    expect(orderBookSnapshotSchema.parse(validSnapshot)).toEqual(validSnapshot);
    expect(orderBookUpdateSchema.parse(validUpdate)).toEqual(validUpdate);
    expect(orderBookEventSchema.parse(validSnapshot)).toEqual(validSnapshot);
    expect(orderBookEventSchema.parse(validUpdate)).toEqual(validUpdate);
    expect(marketEventSchema.parse(validSnapshot)).toEqual(validSnapshot);
  });

  it("rejects numeric level values", () => {
    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        bids: [
          {
            price: 65000,
            quantity: "1.25",
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        bids: [
          {
            price: "65000",
            quantity: 1.25,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects zero quantities in complete snapshots", () => {
    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        bids: [
          {
            price: "65000",
            quantity: "0",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("allows zero quantities in incremental updates", () => {
    expect(orderBookUpdateSchema.safeParse(validUpdate).success).toBe(true);
  });

  it.each(["65000.0", "6.5e4", "065000", "-1", "0"])(
    "rejects invalid order-book price %s",
    (price) => {
      expect(
        orderBookUpdateSchema.safeParse({
          ...validUpdate,
          bids: [
            {
              price,
              quantity: "1",
            },
          ],
        }).success,
      ).toBe(false);
    },
  );

  it("requires safe non-negative sequences", () => {
    for (const sequence of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        orderBookSnapshotSchema.safeParse({
          ...validSnapshot,
          sequence,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown order-book properties", () => {
    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        depth: 20,
      }).success,
    ).toBe(false);

    expect(
      orderBookUpdateSchema.safeParse({
        ...validUpdate,
        bids: [
          {
            price: "65000",
            quantity: "1",
            side: "buy",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires sorted unique snapshot levels", () => {
    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        bids: [
          { price: "64999", quantity: "1" },
          { price: "65000", quantity: "1" },
        ],
      }).success,
    ).toBe(false);

    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        asks: [
          { price: "65002", quantity: "1" },
          { price: "65001", quantity: "1" },
        ],
      }).success,
    ).toBe(false);

    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        bids: [
          { price: "65000", quantity: "1" },
          { price: "65000", quantity: "2" },
        ],
      }).success,
    ).toBe(false);
  });

  it("allows locked snapshots and rejects crossed snapshots", () => {
    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        bids: [{ price: "65000", quantity: "1" }],
        asks: [{ price: "65000", quantity: "1" }],
      }).success,
    ).toBe(true);

    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        bids: [{ price: "65001", quantity: "1" }],
        asks: [{ price: "65000", quantity: "1" }],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate prices within an update side", () => {
    expect(
      orderBookUpdateSchema.safeParse({
        ...validUpdate,
        bids: [
          { price: "65000", quantity: "1" },
          { price: "65000", quantity: "2" },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps order counts consistent with level presence", () => {
    expect(
      orderBookUpdateSchema.safeParse({
        ...validUpdate,
        bids: [
          {
            price: "65000",
            quantity: "1",
            orderCount: 0,
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      orderBookUpdateSchema.safeParse({
        ...validUpdate,
        bids: [
          {
            price: "65000",
            quantity: "0",
            orderCount: 1,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires increasing update sequences", () => {
    expect(
      orderBookUpdateSchema.safeParse({
        ...validUpdate,
        sequence: 100,
        previousSequence: 100,
      }).success,
    ).toBe(false);

    expect(
      orderBookUpdateSchema.safeParse({
        ...validUpdate,
        sequence: 99,
        previousSequence: 100,
      }).success,
    ).toBe(false);
  });

  it("requires ISO timestamps", () => {
    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        timestamp: "not-a-timestamp",
      }).success,
    ).toBe(false);

    expect(
      orderBookUpdateSchema.safeParse({
        ...validUpdate,
        timestamp: "2026-07-20T01:00:01",
      }).success,
    ).toBe(false);
  });

  it("bounds the number of levels on each side", () => {
    const bids = Array.from({ length: 10_001 }, (_, index) => ({
      price: String(20_000 - index),
      quantity: "1",
    }));

    expect(
      orderBookSnapshotSchema.safeParse({
        ...validSnapshot,
        bids,
      }).success,
    ).toBe(false);
  });
});
