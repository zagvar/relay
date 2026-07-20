import {
  compareDecimals,
  nonNegativeDecimalStringSchema,
  positiveDecimalStringSchema,
  type DecimalString,
} from "@zagvar/decimal";
import { z } from "zod";
import { isoTimestampSchema, marketIdentitySchema } from "./market_data.js";

export const MAX_ORDER_BOOK_LEVELS_PER_SIDE = 10_000;

const nonNegativeSafeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const positiveSafeIntegerSchema = nonNegativeSafeIntegerSchema.positive();

/**
 * Runtime schema for one aggregated order-book price level.
 *
 * Snapshot levels require positive prices and quantities because zero-quantity
 * levels do not represent resting liquidity.
 */
export const orderBookLevelSchema = z
  .object({
    price: positiveDecimalStringSchema,
    quantity: positiveDecimalStringSchema,
    orderCount: positiveSafeIntegerSchema.optional(),
  })
  .strict()
  .readonly();

/**
 * One aggregated order-book price level.
 *
 * `quantity` is the total resting quantity at `price`, not an individual
 * order.
 */
export type OrderBookLevel = z.infer<typeof orderBookLevelSchema>;

/**
 * Runtime schema for one changed order-book price level.
 *
 * Update quantity may be zero because zero removes the level from locally
 * maintained state.
 */
export const orderBookUpdateLevelSchema = z
  .object({
    price: positiveDecimalStringSchema,
    quantity: nonNegativeDecimalStringSchema,
    orderCount: nonNegativeSafeIntegerSchema.optional(),
  })
  .strict()
  .superRefine((level, context) => {
    if (level.quantity === "0" && level.orderCount !== undefined && level.orderCount !== 0) {
      context.addIssue({
        code: "custom",
        path: ["orderCount"],
        message: "A removed level cannot have a positive order count.",
      });
    }

    if (level.quantity !== "0" && level.orderCount === 0) {
      context.addIssue({
        code: "custom",
        path: ["orderCount"],
        message: "A resting level cannot have a zero order count.",
      });
    }
  })
  .readonly();

/**
 * One changed order-book price level.
 *
 * A quantity of zero removes the level from locally maintained state.
 */
export type OrderBookUpdateLevel = z.infer<typeof orderBookUpdateLevelSchema>;

function isStrictlySorted(
  levels: readonly { readonly price: DecimalString }[],
  direction: "ascending" | "descending",
): boolean {
  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1];
    const current = levels[index];

    if (previous === undefined || current === undefined) {
      return false;
    }

    const comparison = compareDecimals(previous.price, current.price);

    if (
      (direction === "ascending" && comparison >= 0) ||
      (direction === "descending" && comparison <= 0)
    ) {
      return false;
    }
  }

  return true;
}

function hasDuplicatePrices(levels: readonly { readonly price: DecimalString }[]): boolean {
  const prices = new Set<DecimalString>();

  for (const level of levels) {
    if (prices.has(level.price)) {
      return true;
    }

    prices.add(level.price);
  }

  return false;
}

/** Runtime schema for a complete provider-neutral order book. */
export const orderBookSnapshotSchema = marketIdentitySchema
  .extend({
    type: z.literal("order_book_snapshot"),
    bids: z.array(orderBookLevelSchema).max(MAX_ORDER_BOOK_LEVELS_PER_SIDE).readonly(),
    asks: z.array(orderBookLevelSchema).max(MAX_ORDER_BOOK_LEVELS_PER_SIDE).readonly(),
    timestamp: isoTimestampSchema,
    sequence: nonNegativeSafeIntegerSchema.optional(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const bidsAreSorted = isStrictlySorted(snapshot.bids, "descending");
    const asksAreSorted = isStrictlySorted(snapshot.asks, "ascending");

    if (!bidsAreSorted) {
      context.addIssue({
        code: "custom",
        path: ["bids"],
        message: "Bid levels must have unique prices ordered from highest to lowest.",
      });
    }

    if (!asksAreSorted) {
      context.addIssue({
        code: "custom",
        path: ["asks"],
        message: "Ask levels must have unique prices ordered from lowest to highest.",
      });
    }

    const bestBid = snapshot.bids[0];
    const bestAsk = snapshot.asks[0];

    if (
      bidsAreSorted &&
      asksAreSorted &&
      bestBid !== undefined &&
      bestAsk !== undefined &&
      compareDecimals(bestBid.price, bestAsk.price) > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["bids", 0, "price"],
        message: "Best bid price must be less than or equal to best ask price.",
      });
    }
  });

/**
 * A complete provider-neutral order-book state.
 *
 * Bids are ordered from highest to lowest price. Asks are ordered from lowest
 * to highest price.
 */
export type OrderBookSnapshot = Readonly<z.infer<typeof orderBookSnapshotSchema>>;

/** Runtime schema for a provider-neutral order-book update. */
export const orderBookUpdateSchema = marketIdentitySchema
  .extend({
    type: z.literal("order_book_update"),
    bids: z.array(orderBookUpdateLevelSchema).max(MAX_ORDER_BOOK_LEVELS_PER_SIDE).readonly(),
    asks: z.array(orderBookUpdateLevelSchema).max(MAX_ORDER_BOOK_LEVELS_PER_SIDE).readonly(),
    timestamp: isoTimestampSchema,
    sequence: nonNegativeSafeIntegerSchema.optional(),
    previousSequence: nonNegativeSafeIntegerSchema.optional(),
    reset: z.boolean(),
  })
  .strict()
  .superRefine((update, context) => {
    if (hasDuplicatePrices(update.bids)) {
      context.addIssue({
        code: "custom",
        path: ["bids"],
        message: "An update cannot contain duplicate bid prices.",
      });
    }

    if (hasDuplicatePrices(update.asks)) {
      context.addIssue({
        code: "custom",
        path: ["asks"],
        message: "An update cannot contain duplicate ask prices.",
      });
    }

    if (
      update.sequence !== undefined &&
      update.previousSequence !== undefined &&
      update.sequence <= update.previousSequence
    ) {
      context.addIssue({
        code: "custom",
        path: ["sequence"],
        message: "Sequence must be greater than previousSequence.",
      });
    }
  });

/**
 * A provider-neutral batch of changed order-book levels.
 *
 * Positive quantity inserts or replaces a level. Zero quantity removes it.
 * Providers without sequence continuity may omit the sequence fields.
 */
export type OrderBookUpdate = Readonly<z.infer<typeof orderBookUpdateSchema>>;

/** Runtime schema for any normalized order-book event. */
export const orderBookEventSchema = z.discriminatedUnion("type", [
  orderBookSnapshotSchema,
  orderBookUpdateSchema,
]);

/** Any normalized order-book event Relay can transport. */
export type OrderBookEvent = z.infer<typeof orderBookEventSchema>;
