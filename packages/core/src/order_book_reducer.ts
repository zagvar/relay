import type {
  OrderBookLevel,
  OrderBookSnapshot,
  OrderBookUpdate,
  OrderBookUpdateLevel,
} from "./order_book.js";

/** Reasons an update cannot be safely applied to the current snapshot. */
export type OrderBookUpdateFailure = "instrument_mismatch" | "stale_sequence" | "sequence_gap";

/** Result of reconciling an update with a local order-book snapshot. */
export type OrderBookUpdateResult =
  | {
      readonly applied: true;
      readonly snapshot: OrderBookSnapshot;
    }
  | {
      readonly applied: false;
      readonly reason: OrderBookUpdateFailure;
    };

/** Options controlling the locally maintained order book. */
export interface ApplyOrderBookUpdateOptions {
  /**
   * Maximum number of levels retained on each side.
   *
   * When omitted, all reconciled levels are retained.
   */
  readonly depth?: number;
}

/**
 * Reconciles an incremental or resetting update with a local order book.
 *
 * The reducer rejects cross-instrument, stale, and discontinuous updates
 * instead of silently producing an inaccurate local book.
 */
export function applyOrderBookUpdate(
  snapshot: OrderBookSnapshot,
  update: OrderBookUpdate,
  options: ApplyOrderBookUpdateOptions = {},
): OrderBookUpdateResult {
  if (!hasMatchingIdentity(snapshot, update)) {
    return {
      applied: false,
      reason: "instrument_mismatch",
    };
  }

  if (
    snapshot.sequence !== undefined &&
    update.sequence !== undefined &&
    update.sequence <= snapshot.sequence
  ) {
    return {
      applied: false,
      reason: "stale_sequence",
    };
  }

  if (update.previousSequence !== undefined && snapshot.sequence !== update.previousSequence) {
    return {
      applied: false,
      reason: "sequence_gap",
    };
  }

  const depth = options.depth ?? Number.POSITIVE_INFINITY;

  if (depth !== Number.POSITIVE_INFINITY && (!Number.isInteger(depth) || depth <= 0)) {
    throw new RangeError("depth must be a positive integer.");
  }

  const bids = reconcileSide(update.reset ? [] : snapshot.bids, update.bids, "descending").slice(
    0,
    depth,
  );

  const asks = reconcileSide(update.reset ? [] : snapshot.asks, update.asks, "ascending").slice(
    0,
    depth,
  );

  return {
    applied: true,
    snapshot: {
      ...snapshot,
      bids,
      asks,
      timestamp: update.timestamp,
      ...(update.sequence === undefined ? {} : { sequence: update.sequence }),
    },
  };
}

function hasMatchingIdentity(snapshot: OrderBookSnapshot, update: OrderBookUpdate): boolean {
  return (
    snapshot.symbol === update.symbol &&
    snapshot.assetClass === update.assetClass &&
    snapshot.venue === update.venue &&
    snapshot.baseAsset === update.baseAsset &&
    snapshot.quoteAsset === update.quoteAsset
  );
}

function reconcileSide(
  current: readonly OrderBookLevel[],
  updates: readonly OrderBookUpdateLevel[],
  direction: "ascending" | "descending",
): OrderBookLevel[] {
  const levels = new Map(current.map((level) => [level.price, level]));

  for (const update of updates) {
    /** An incremental update permits zero because it is the deletion instruction. */
    if (update.quantity === 0) {
      levels.delete(update.price);
    } else {
      levels.set(update.price, update);
    }
  }

  return [...levels.values()].sort((left, right) =>
    direction === "ascending" ? left.price - right.price : right.price - left.price,
  );
}
