# @zagvar/relay-core

Provider-neutral contracts and utilities for Relay.

This package defines the shared language used by Relay adapters, caches, event buses, and transports. It intentionally avoids provider-specific code, Redis, websockets, databases, and framework dependencies.

## Current Scope

- Normalized market data types
- Asset-class-neutral instrument metadata
- Provider capability contracts
- Event channel names
- In-memory event bus for tests and demos
- Market data cache contracts
- In-memory market data cache
- Market data pipeline helpers
- Market summary conflation for live asset tables
- Symbol batching and normalization
- Reconnect and throttling utilities

## Market Summary Conflation

Live asset tables usually do not need every raw quote or trade event. A busy
symbol can update many times per second, while the browser often only needs the
latest display state at a steady cadence.

`MarketSummaryConflator` keeps the latest summary for each symbol and flushes a
batch on an interval:

```ts
import {
  MarketDataPipeline,
  MarketSummaryConflator,
  type MarketSummary,
} from "@zagvar/relay-core";

declare const pipeline: MarketDataPipeline;

const conflator = new MarketSummaryConflator({
  intervalMs: 250,
  onFlush: async (marketSummaries: readonly MarketSummary[]) => {
    await pipeline.processMarketSummaries(
      Object.fromEntries(
        marketSummaries.map((marketSummary) => [marketSummary.symbol, marketSummary]),
      ),
    );
  },
  onError: (error: unknown) => {
    console.error(error);
  },
});

conflator.update({
  symbol: "AAPL",
  price: 195.2,
});
```

Raw market events can still be cached and published separately. The conflator is
for derived, client-facing summaries where publishing the freshest value once per
window is more useful than forwarding every intermediate update.

## Status

This package is under active development. The public API may change before the first stable release.

## License

MIT
