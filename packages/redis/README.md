# @zagvar/relay-redis

Redis-backed implementations of Relay's market-data cache and event bus
contracts.

## Cache

`RedisMarketDataCache` stores:

- latest quotes and trades
- latest market summaries
- recent bar series
- latest complete order-book snapshots
- the latest market clock

```ts
import { RedisMarketDataCache } from "@zagvar/relay-redis";

const cache = new RedisMarketDataCache({
  client: redisClient,
  prefix: "my-app",
  marketSummaryTtlSeconds: 30,
  marketClockTtlSeconds: 60,
  barRetention: {
    default: { maxBars: 500, ttlSeconds: 86_400 },
    byTimeframe: {
      "1d": { maxBars: 365, ttlSeconds: 2_592_000 },
    },
  },
});
```

The client must implement Relay's small `RedisCacheClient` interface, allowing
applications to adapt their preferred Redis library.

## Venue-Aware Keys

Quotes and trades are stored in Redis hashes whose fields identify both symbol
and optional venue. Bars additionally include their timeframe. Each order-book
snapshot has its own symbol-and-venue key.

```ts
await cache.getLatestQuote({ symbol: "BTC/USD", venue: "COINBASE" });
await cache.getBars({
  symbol: "BTC/USD",
  venue: "COINBASE",
  timeframe: "1m",
});
await cache.getOrderBookSnapshot({ symbol: "BTC/USD", venue: "COINBASE" });
```

Symbols and venues are normalized when keys are created. An omitted venue maps
to a distinct default stream rather than matching every venue.

## Bar Retention

Bars use Redis sorted sets scored by timestamp. `maxBars` trims old entries and
`ttlSeconds` expires an inactive series. Timeframe-specific settings override the
default retention policy.

Redis is intended as a hot cache, not a durable historical store. Longer history
should generally come from a provider API, database, object storage, or dedicated
time-series system.

## Event Bus

`RedisRelayEventBus` implements Relay pub/sub using namespaced event channels.
It is suitable for distributing normalized Relay messages between application
processes before they are filtered and forwarded to clients.

## Status

Under active development. The public API may change before the first stable
release.

## License

MIT
