import { z } from "zod";
import {
  barsRequestSchema,
  createBarSubscriptionKey,
  createMarketDataRequestKey,
  marketDataHydrationRequestSchema,
  marketDataRequestSchema,
  marketEventChannelSchema,
  marketIdentifierSchema,
  normalizeSymbol,
  timeframeSchema,
} from "@zagvar/relay-core";

export const RELAY_CLIENT_MESSAGE_MAX_BYTES = 64 * 1024;

export const RELAY_CLIENT_MESSAGE_MAX_ITEMS = 500;

const channelArraySchema = z
  .array(marketEventChannelSchema)
  .max(RELAY_CLIENT_MESSAGE_MAX_ITEMS)
  .superRefine((channels, context) => {
    addDuplicateIssues(channels, (channel) => channel, context);
  })
  .readonly();

const symbolArraySchema = z
  .array(marketIdentifierSchema)
  .max(RELAY_CLIENT_MESSAGE_MAX_ITEMS)
  .superRefine((symbols, context) => {
    addDuplicateIssues(symbols, normalizeSymbol, context);
  })
  .readonly();

const marketDataRequestArraySchema = z
  .array(marketDataRequestSchema)
  .max(RELAY_CLIENT_MESSAGE_MAX_ITEMS)
  .superRefine((requests, context) => {
    addDuplicateIssues(requests, createMarketDataRequestKey, context);
  })
  .readonly();

const barSubscriptionSchema = z
  .object({
    symbol: marketIdentifierSchema,
    venue: marketIdentifierSchema.optional(),
    timeframe: timeframeSchema,
  })
  .strict();

const barSubscriptionArraySchema = z
  .array(barSubscriptionSchema)
  .max(RELAY_CLIENT_MESSAGE_MAX_ITEMS)
  .superRefine((subscriptions, context) => {
    addDuplicateIssues(subscriptions, createBarSubscriptionKey, context);
  })
  .readonly();

const barsHydrationRequestArraySchema = z
  .array(barsRequestSchema)
  .max(RELAY_CLIENT_MESSAGE_MAX_ITEMS)
  .superRefine((requests, context) => {
    addDuplicateIssues(
      requests,
      (request) =>
        JSON.stringify([
          createBarSubscriptionKey(request),
          request.start ?? null,
          request.end ?? null,
          request.limit ?? null,
        ]),
      context,
    );
  })
  .readonly();

const boundedHydrationRequestSchema = marketDataHydrationRequestSchema
  .extend({
    symbols: symbolArraySchema.optional(),
    quotes: marketDataRequestArraySchema.optional(),
    trades: marketDataRequestArraySchema.optional(),
    bars: barsHydrationRequestArraySchema.optional(),
    orderBooks: marketDataRequestArraySchema.optional(),
  })
  .superRefine((request, context) => {
    const itemCount =
      (request.symbols?.length ?? 0) +
      (request.quotes?.length ?? 0) +
      (request.trades?.length ?? 0) +
      (request.bars?.length ?? 0) +
      (request.orderBooks?.length ?? 0);

    if (itemCount > RELAY_CLIENT_MESSAGE_MAX_ITEMS) {
      context.addIssue({
        code: "custom",
        message: "A hydration request cannot contain more than 500 total items.",
      });
    }
  });

const subscribeChannelsMessageSchema = z
  .object({
    type: z.literal("subscribe_channels"),
    channels: channelArraySchema,
  })
  .strict()
  .readonly();

const unsubscribeChannelsMessageSchema = z
  .object({
    type: z.literal("unsubscribe_channels"),
    channels: channelArraySchema,
  })
  .strict()
  .readonly();

const subscribeMarketSummariesMessageSchema = z
  .object({
    type: z.literal("subscribe_market_summaries"),
    symbols: symbolArraySchema,
  })
  .strict()
  .readonly();

const unsubscribeMarketSummariesMessageSchema = z
  .object({
    type: z.literal("unsubscribe_market_summaries"),
    symbols: symbolArraySchema,
  })
  .strict()
  .readonly();

const subscribeQuotesMessageSchema = z
  .object({
    type: z.literal("subscribe_quotes"),
    quotes: marketDataRequestArraySchema,
  })
  .strict()
  .readonly();

const unsubscribeQuotesMessageSchema = z
  .object({
    type: z.literal("unsubscribe_quotes"),
    quotes: marketDataRequestArraySchema,
  })
  .strict()
  .readonly();

const subscribeTradesMessageSchema = z
  .object({
    type: z.literal("subscribe_trades"),
    trades: marketDataRequestArraySchema,
  })
  .strict()
  .readonly();

const unsubscribeTradesMessageSchema = z
  .object({
    type: z.literal("unsubscribe_trades"),
    trades: marketDataRequestArraySchema,
  })
  .strict()
  .readonly();

const subscribeOrderBooksMessageSchema = z
  .object({
    type: z.literal("subscribe_order_books"),
    orderBooks: marketDataRequestArraySchema,
  })
  .strict()
  .readonly();

const unsubscribeOrderBooksMessageSchema = z
  .object({
    type: z.literal("unsubscribe_order_books"),
    orderBooks: marketDataRequestArraySchema,
  })
  .strict()
  .readonly();

const subscribeBarsMessageSchema = z
  .object({
    type: z.literal("subscribe_bars"),
    bars: barSubscriptionArraySchema,
  })
  .strict()
  .readonly();

const unsubscribeBarsMessageSchema = z
  .object({
    type: z.literal("unsubscribe_bars"),
    bars: barSubscriptionArraySchema,
  })
  .strict()
  .readonly();

const hydrateMessageSchema = z
  .object({
    type: z.literal("hydrate"),
    request: boundedHydrationRequestSchema,
  })
  .strict()
  .readonly();

/** Runtime schema for messages accepted from Relay WebSocket clients. */
export const relayClientMessageSchema = z.discriminatedUnion("type", [
  subscribeChannelsMessageSchema,
  unsubscribeChannelsMessageSchema,
  subscribeMarketSummariesMessageSchema,
  unsubscribeMarketSummariesMessageSchema,
  subscribeQuotesMessageSchema,
  unsubscribeQuotesMessageSchema,
  subscribeTradesMessageSchema,
  unsubscribeTradesMessageSchema,
  subscribeOrderBooksMessageSchema,
  unsubscribeOrderBooksMessageSchema,
  subscribeBarsMessageSchema,
  unsubscribeBarsMessageSchema,
  hydrateMessageSchema,
]);

/** Client message sent over a Relay WebSocket connection. */
export type RelayClientMessage = z.infer<typeof relayClientMessageSchema>;

export type SubscribeChannelsMessage = Extract<
  RelayClientMessage,
  { readonly type: "subscribe_channels" }
>;

export type UnsubscribeChannelsMessage = Extract<
  RelayClientMessage,
  { readonly type: "unsubscribe_channels" }
>;

export type SubscribeMarketSummariesMessage = Extract<
  RelayClientMessage,
  { readonly type: "subscribe_market_summaries" }
>;

export type UnsubscribeMarketSummariesMessage = Extract<
  RelayClientMessage,
  { readonly type: "unsubscribe_market_summaries" }
>;

export type SubscribeQuotesMessage = Extract<
  RelayClientMessage,
  { readonly type: "subscribe_quotes" }
>;

export type UnsubscribeQuotesMessage = Extract<
  RelayClientMessage,
  { readonly type: "unsubscribe_quotes" }
>;

export type SubscribeTradesMessage = Extract<
  RelayClientMessage,
  { readonly type: "subscribe_trades" }
>;

export type UnsubscribeTradesMessage = Extract<
  RelayClientMessage,
  { readonly type: "unsubscribe_trades" }
>;

export type SubscribeOrderBooksMessage = Extract<
  RelayClientMessage,
  { readonly type: "subscribe_order_books" }
>;

export type UnsubscribeOrderBooksMessage = Extract<
  RelayClientMessage,
  { readonly type: "unsubscribe_order_books" }
>;

export type SubscribeBarsMessage = Extract<RelayClientMessage, { readonly type: "subscribe_bars" }>;

export type UnsubscribeBarsMessage = Extract<
  RelayClientMessage,
  { readonly type: "unsubscribe_bars" }
>;

export type HydrateMessage = Extract<RelayClientMessage, { readonly type: "hydrate" }>;

/** Parses and validates one raw WebSocket client message. */
export function parseRelayClientMessage(rawMessage: string): RelayClientMessage {
  const byteLength = Buffer.byteLength(rawMessage, "utf8");

  if (byteLength > RELAY_CLIENT_MESSAGE_MAX_BYTES) {
    throw new RangeError(
      `Relay client messages cannot exceed ${String(RELAY_CLIENT_MESSAGE_MAX_BYTES)} bytes.`,
    );
  }

  const parsedMessage: unknown = JSON.parse(rawMessage);

  return relayClientMessageSchema.parse(parsedMessage);
}

function addDuplicateIssues<T>(
  values: readonly T[],
  createKey: (value: T) => string,
  context: z.RefinementCtx,
): void {
  const keys = new Set<string>();

  values.forEach((value, index) => {
    const key = createKey(value);

    if (keys.has(key)) {
      context.addIssue({
        code: "custom",
        path: [index],
        message: "Client message entries must be unique.",
      });
    }

    keys.add(key);
  });
}
