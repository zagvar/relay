# @zagvar/relay-core

Provider-neutral market-data contracts and processing primitives for Relay.

This package defines the shared language used by adapters, caches, event buses,
and transports. It has no provider, Redis, WebSocket, database, or framework
dependency.

## Current Scope

- normalized trades, quotes, bars, market summaries, and market clocks
- venue-aware market-data identity and request contracts
- order-book snapshots, updates, and deterministic reconciliation
- provider capability and connection contracts
- cache, event bus, hydration, and subscription primitives
- cache-and-publish market-data pipeline
- market-summary conflation
- symbol normalization, batching, reconnect, and throttling utilities

## Identity And Venue Semantics

Every normalized event carries a `MarketIdentity`:

```ts
interface MarketIdentity {
  readonly symbol: string;
  readonly assetClass: AssetClass;
  readonly venue?: string;
  readonly baseAsset?: string;
  readonly quoteAsset?: string;
}
```

Cache lookups and subscriptions use the smaller `MarketDataRequest` shape:

```ts
const request = {
  symbol: "BTC/USD",
  venue: "COINBASE",
};
```

`venue` distinguishes feeds for the same symbol. When it is omitted, the request
addresses the application's default or consolidated stream; it is not a wildcard
over every venue.

## Pipeline

`MarketDataPipeline` stores a normalized event and publishes it to the matching
event channel:

```ts
import { MarketDataPipeline, MemoryMarketDataCache, MemoryRelayEventBus } from "@zagvar/relay-core";

const cache = new MemoryMarketDataCache();
const eventBus = new MemoryRelayEventBus();
const pipeline = new MarketDataPipeline({ cache, eventBus });

await pipeline.processEvent({
  type: "trade",
  symbol: "BTC/USD",
  assetClass: "crypto",
  venue: "COINBASE",
  price: "68250.5",
  quantity: "0.02",
  timestamp: "2026-07-12T01:30:00.000Z",
});
```

Applications can use the in-memory implementations for tests and single-process
demos, or provide implementations of `MarketDataCache` and `RelayEventBus`.

## Decimal Values

Economic values such as prices, quantities, volumes, and VWAP use canonical
decimal strings. Use `@zagvar/decimal` to validate, canonicalize, compare, and
calculate with them. Do not convert these values to JavaScript `number` before
business calculations or transport.

Canonical unsigned values use plain decimal notation, omit redundant leading
zeros and trailing fractional zeros, and represent zero as `"0"`. Schemas apply
positive or non-negative constraints according to each field's meaning.

## Hydration

`MarketDataHydrator` reads the latest cached state for an initial client view:

```ts
import { MarketDataHydrator } from "@zagvar/relay-core";

const hydrator = new MarketDataHydrator(cache);

const hydration = await hydrator.hydrate({
  quotes: [{ symbol: "BTC/USD", venue: "COINBASE" }],
  trades: [{ symbol: "BTC/USD", venue: "COINBASE" }],
  bars: [{ symbol: "BTC/USD", venue: "COINBASE", timeframe: "1m" }],
  orderBooks: [{ symbol: "BTC/USD", venue: "COINBASE" }],
});
```

Missing cache entries are omitted from the response. Hydration does not fetch
from the upstream provider.

## Order Books

`OrderBookSnapshot` represents a complete book. `OrderBookUpdate` represents
changed levels: a positive quantity inserts or replaces a level, while zero
removes it. Bids are kept highest-first and asks lowest-first.

`applyOrderBookUpdate` validates identity and sequence continuity before producing
a new immutable snapshot. The pipeline refuses an incremental update when its
snapshot is missing or reconciliation fails and throws `OrderBookPipelineError`.
The application should then fetch a fresh provider snapshot before processing
more updates for that book.

## Provider Capabilities

Adapters describe supported features through `ProviderCapabilities`, including
historical bars, order-book snapshots, market clocks, and live trade, quote, bar,
or order-book streams. Use `hasProviderCapability` for branching or
`assertProviderCapability` when a feature is required.

`MarketDataProvider` defines provider-neutral historical and snapshot methods.
Its optional `connectLive` method exposes a normalized event stream; provider
adapters remain responsible for authentication, raw payload parsing, and upstream
subscription details.

## Market Summary Conflation

`MarketSummaryConflator` retains the newest summary per symbol and periodically
flushes a batch. It is useful for watchlists and market tables that need steady
client-facing updates rather than every intermediate provider event.

Raw events can still be cached and published separately.

## Status

Under active development. The public API may change before the first stable
release.

## License

MIT
