import {
  compareDecimals,
  nonNegativeDecimalStringSchema,
  positiveDecimalStringSchema,
  signedDecimalStringSchema,
} from "@zagvar/decimal";
import { z } from "zod";

function boundedNonBlankStringSchema(maxLength: number) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value === value.trim(), {
      message: "Expected a non-blank string without surrounding whitespace.",
    });
}

export const marketIdentifierSchema = boundedNonBlankStringSchema(64);
export const timeframeSchema = boundedNonBlankStringSchema(32);
const providerTradeIdSchema = boundedNonBlankStringSchema(256);

export const isoTimestampSchema = z.iso.datetime({
  offset: true,
});

const nonNegativeSafeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const positiveSafeIntegerSchema = nonNegativeSafeIntegerSchema.positive();

/** Runtime schema for a broad asset class supported by market data providers. */
export const assetClassSchema = z.enum([
  "equity",
  "crypto",
  "fx",
  "commodity",
  "index",
  "fund",
  "option",
  "future",
  "other",
]);

/** A broad asset class supported by market data providers. */
export type AssetClass = z.infer<typeof assetClassSchema>;

/**
 * Runtime schema for provider-neutral market identity.
 *
 * `assetClass` describes the instrument's economic exposure.
 * `venue` identifies where its market data or trading activity originates.
 */
export const marketIdentitySchema = z
  .object({
    symbol: marketIdentifierSchema,
    assetClass: assetClassSchema,
    venue: marketIdentifierSchema.optional(),
    baseAsset: marketIdentifierSchema.optional(),
    quoteAsset: marketIdentifierSchema.optional(),
  })
  .strict();

/**
 * Provider-neutral identity shared by Relay market-data contracts.
 *
 * Pair-based instruments may provide `baseAsset` and `quoteAsset`.
 */
export type MarketIdentity = Readonly<z.infer<typeof marketIdentitySchema>>;

/** Runtime schema for a symbol and optional venue request. */
export const marketDataRequestSchema = z
  .object({
    symbol: marketIdentifierSchema,
    venue: marketIdentifierSchema.optional(),
  })
  .strict();

/** Identifies one symbol and optional venue in cache and subscription APIs. */
export type MarketDataRequest = Readonly<z.infer<typeof marketDataRequestSchema>>;

/** Runtime schema for a normalized latest trade event. */
export const marketTradeSchema = marketIdentitySchema
  .extend({
    type: z.literal("trade"),
    price: positiveDecimalStringSchema,
    quantity: positiveDecimalStringSchema,
    timestamp: isoTimestampSchema,
    providerTradeId: providerTradeIdSchema.optional(),
  })
  .strict();

/** A normalized latest trade event from a market data provider. */
export type MarketTrade = Readonly<z.infer<typeof marketTradeSchema>>;

/** Runtime schema for a normalized best bid and offer update. */
export const marketQuoteSchema = marketIdentitySchema
  .extend({
    type: z.literal("quote"),
    bidPrice: positiveDecimalStringSchema,
    bidQuantity: nonNegativeDecimalStringSchema,
    askPrice: positiveDecimalStringSchema,
    askQuantity: nonNegativeDecimalStringSchema,
    timestamp: isoTimestampSchema,
    bidVenue: marketIdentifierSchema.optional(),
    askVenue: marketIdentifierSchema.optional(),
  })
  .strict()
  .superRefine((quote, context) => {
    if (compareDecimals(quote.bidPrice, quote.askPrice) > 0) {
      context.addIssue({
        code: "custom",
        path: ["bidPrice"],
        message: "Bid price must be less than or equal to ask price.",
      });
    }
  });

/**
 * A normalized best bid and offer update.
 *
 * `bidVenue` and `askVenue` may differ from the identity-level `venue` when
 * the quote is consolidated across multiple venues.
 */
export type MarketQuote = Readonly<z.infer<typeof marketQuoteSchema>>;

/** Runtime schema for a normalized OHLCV bar. */
export const marketBarSchema = marketIdentitySchema
  .extend({
    type: z.literal("bar"),
    timeframe: timeframeSchema,
    open: positiveDecimalStringSchema,
    high: positiveDecimalStringSchema,
    low: positiveDecimalStringSchema,
    close: positiveDecimalStringSchema,
    volume: nonNegativeDecimalStringSchema,
    timestamp: isoTimestampSchema,
    tradeCount: nonNegativeSafeIntegerSchema.optional(),
    volumeWeightedAveragePrice: positiveDecimalStringSchema.optional(),
  })
  .strict()
  .superRefine((bar, context) => {
    if (compareDecimals(bar.high, bar.low) < 0) {
      context.addIssue({
        code: "custom",
        path: ["high"],
        message: "High price must be greater than or equal to low price.",
      });

      return;
    }

    for (const [field, value] of [
      ["open", bar.open],
      ["close", bar.close],
    ] as const) {
      if (compareDecimals(value, bar.low) < 0 || compareDecimals(value, bar.high) > 0) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field === "open" ? "Open" : "Close"} price must be within the low-high range.`,
        });
      }
    }

    if (
      bar.volumeWeightedAveragePrice !== undefined &&
      (compareDecimals(bar.volumeWeightedAveragePrice, bar.low) < 0 ||
        compareDecimals(bar.volumeWeightedAveragePrice, bar.high) > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["volumeWeightedAveragePrice"],
        message: "Volume-weighted average price must be within the low-high range.",
      });
    }
  });

/** A normalized OHLCV bar. */
export type MarketBar = Readonly<z.infer<typeof marketBarSchema>>;

/** Runtime schema for consolidated current market state. */
export const marketSummarySchema = marketIdentitySchema
  .extend({
    price: positiveDecimalStringSchema,
    timestamp: isoTimestampSchema.optional(),
    quantity: nonNegativeDecimalStringSchema.optional(),
    open: positiveDecimalStringSchema.optional(),
    high: positiveDecimalStringSchema.optional(),
    low: positiveDecimalStringSchema.optional(),
    previousClose: positiveDecimalStringSchema.optional(),
    volume: nonNegativeDecimalStringSchema.optional(),
    previousVolume: nonNegativeDecimalStringSchema.optional(),
    change: signedDecimalStringSchema.optional(),
    changePercent: signedDecimalStringSchema.optional(),
    bidPrice: positiveDecimalStringSchema.optional(),
    bidQuantity: nonNegativeDecimalStringSchema.optional(),
    askPrice: positiveDecimalStringSchema.optional(),
    askQuantity: nonNegativeDecimalStringSchema.optional(),
  })
  .strict()
  .superRefine((summary, context) => {
    if (
      summary.bidPrice !== undefined &&
      summary.askPrice !== undefined &&
      compareDecimals(summary.bidPrice, summary.askPrice) > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["bidPrice"],
        message: "Bid price must be less than or equal to ask price.",
      });
    }

    if (
      summary.high !== undefined &&
      summary.low !== undefined &&
      compareDecimals(summary.high, summary.low) < 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["high"],
        message: "High price must be greater than or equal to low price.",
      });
    }
  });

/**
 * Consolidated current market state for an instrument.
 *
 * Suitable for watchlists, market tables, and portfolio displays.
 */
export type MarketSummary = Readonly<z.infer<typeof marketSummarySchema>>;

/** Runtime schema for a normalized exchange or venue clock. */
export const marketClockSchema = z
  .object({
    isOpen: z.boolean(),
    timestamp: isoTimestampSchema,
    nextOpen: isoTimestampSchema.optional(),
    nextClose: isoTimestampSchema.optional(),
  })
  .strict();

/** A normalized exchange or venue clock. */
export type MarketClock = Readonly<z.infer<typeof marketClockSchema>>;

/** Runtime schema for historical bar request parameters. */
export const barsRequestSchema = marketDataRequestSchema
  .extend({
    timeframe: timeframeSchema,
    start: isoTimestampSchema.optional(),
    end: isoTimestampSchema.optional(),
    limit: positiveSafeIntegerSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.start !== undefined &&
      request.end !== undefined &&
      Date.parse(request.start) > Date.parse(request.end)
    ) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "End timestamp must be greater than or equal to start timestamp.",
      });
    }
  });

/** Request parameters for historical bars. */
export type BarsRequest = Readonly<z.infer<typeof barsRequestSchema>>;
