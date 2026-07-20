import { z } from "zod";
import { marketBarSchema, marketQuoteSchema, marketTradeSchema } from "./market_data.js";
import { orderBookSnapshotSchema, orderBookUpdateSchema } from "./order_book.js";

/** Runtime schema for any normalized market event Relay can transport. */
export const marketEventSchema = z.discriminatedUnion("type", [
  marketTradeSchema,
  marketQuoteSchema,
  marketBarSchema,
  orderBookSnapshotSchema,
  orderBookUpdateSchema,
]);

/** Any normalized market event Relay can move through a transport. */
export type MarketEvent = Readonly<z.infer<typeof marketEventSchema>>;
