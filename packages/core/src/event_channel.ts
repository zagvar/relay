import { z } from "zod";
import {
  marketBarSchema,
  marketClockSchema,
  marketQuoteSchema,
  marketSummarySchema,
  marketTradeSchema,
} from "./market_data.js";
import { orderBookEventSchema } from "./order_book.js";

/** Stable channel names used by Relay transports and storage adapters. */
export const MARKET_EVENT_CHANNEL = {
  trade: "trade",
  quote: "quote",
  bar: "bar",
  orderBook: "order_book",
  marketSummary: "market_summary",
  marketClock: "market_clock",
} as const;

/** Runtime schema for a stable Relay market-event channel. */
export const marketEventChannelSchema = z.enum([
  MARKET_EVENT_CHANNEL.trade,
  MARKET_EVENT_CHANNEL.quote,
  MARKET_EVENT_CHANNEL.bar,
  MARKET_EVENT_CHANNEL.orderBook,
  MARKET_EVENT_CHANNEL.marketSummary,
  MARKET_EVENT_CHANNEL.marketClock,
]);

/** A stable channel name used to route normalized market data. */
export type MarketEventChannel = z.infer<typeof marketEventChannelSchema>;

const relayTradeMessageSchema = z
  .object({
    channel: z.literal(MARKET_EVENT_CHANNEL.trade),
    data: marketTradeSchema,
  })
  .strict();

const relayQuoteMessageSchema = z
  .object({
    channel: z.literal(MARKET_EVENT_CHANNEL.quote),
    data: marketQuoteSchema,
  })
  .strict();

const relayBarMessageSchema = z
  .object({
    channel: z.literal(MARKET_EVENT_CHANNEL.bar),
    data: marketBarSchema,
  })
  .strict();

const relayOrderBookMessageSchema = z
  .object({
    channel: z.literal(MARKET_EVENT_CHANNEL.orderBook),
    data: orderBookEventSchema,
  })
  .strict();

const relayMarketSummaryMessageSchema = z
  .object({
    channel: z.literal(MARKET_EVENT_CHANNEL.marketSummary),
    data: marketSummarySchema,
  })
  .strict();

const relayMarketClockMessageSchema = z
  .object({
    channel: z.literal(MARKET_EVENT_CHANNEL.marketClock),
    data: marketClockSchema,
  })
  .strict();

/**
 * Runtime schema for any transport-neutral Relay message.
 *
 * The discriminated union ensures that each channel carries its corresponding
 * normalized data contract.
 */
export const relayMessageSchema = z.discriminatedUnion("channel", [
  relayTradeMessageSchema,
  relayQuoteMessageSchema,
  relayBarMessageSchema,
  relayOrderBookMessageSchema,
  relayMarketSummaryMessageSchema,
  relayMarketClockMessageSchema,
]);

/** Data contract associated with each Relay channel. */
export interface RelayMessageDataByChannel {
  readonly [MARKET_EVENT_CHANNEL.trade]: z.infer<typeof marketTradeSchema>;
  readonly [MARKET_EVENT_CHANNEL.quote]: z.infer<typeof marketQuoteSchema>;
  readonly [MARKET_EVENT_CHANNEL.bar]: z.infer<typeof marketBarSchema>;
  readonly [MARKET_EVENT_CHANNEL.orderBook]: z.infer<typeof orderBookEventSchema>;
  readonly [MARKET_EVENT_CHANNEL.marketSummary]: z.infer<typeof marketSummarySchema>;
  readonly [MARKET_EVENT_CHANNEL.marketClock]: z.infer<typeof marketClockSchema>;
}

/** A transport-neutral message moved through Relay. */
export type RelayMessage<TChannel extends MarketEventChannel = MarketEventChannel> =
  TChannel extends MarketEventChannel
    ? Readonly<{
        channel: TChannel;
        data: RelayMessageDataByChannel[TChannel];
      }>
    : never;

/** Creates a correctly correlated transport-neutral Relay message. */
export function createRelayMessage<TChannel extends MarketEventChannel>(
  channel: TChannel,
  data: RelayMessageDataByChannel[TChannel],
): RelayMessage<TChannel> {
  return { channel, data } as RelayMessage<TChannel>;
}

/**
 * Parses a Relay message expected on one transport channel.
 *
 * Selecting the schema by the expected channel rejects otherwise-valid
 * messages delivered through the wrong Redis or WebSocket channel.
 */
export function parseRelayMessage<TChannel extends MarketEventChannel>(
  value: unknown,
  expectedChannel: TChannel,
): RelayMessage<TChannel> {
  const schemaByChannel = {
    [MARKET_EVENT_CHANNEL.trade]: relayTradeMessageSchema,
    [MARKET_EVENT_CHANNEL.quote]: relayQuoteMessageSchema,
    [MARKET_EVENT_CHANNEL.bar]: relayBarMessageSchema,
    [MARKET_EVENT_CHANNEL.orderBook]: relayOrderBookMessageSchema,
    [MARKET_EVENT_CHANNEL.marketSummary]: relayMarketSummaryMessageSchema,
    [MARKET_EVENT_CHANNEL.marketClock]: relayMarketClockMessageSchema,
  } as const;

  return schemaByChannel[expectedChannel].parse(value) as RelayMessage<TChannel>;
}
