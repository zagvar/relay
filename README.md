# Relay

Relay is a provider-neutral TypeScript foundation for market-data ingestion,
normalization, caching, pub/sub, and realtime client delivery.

It focuses on the market-data infrastructure shared by trading applications. It
does not prescribe accounts, balances, authentication, order management, or
other product-specific backend features.

## Packages

- `@zagvar/relay-core` — normalized contracts, provider capabilities, in-memory
  primitives, hydration, subscriptions, pipelines, and order-book reconciliation.
- `@zagvar/relay-redis` — Redis-backed market-data cache and event bus.
- `@zagvar/relay-ws` — cached hydration and live market-data delivery over
  WebSockets.
- `@zagvar/relay-adapter-alpaca` — Alpaca stock stream adapter and reference
  implementation for provider integrations.

## Market Data

Relay currently models:

- trades
- best bid and ask quotes
- OHLCV bars
- market summaries and market clocks
- full order-book snapshots and incremental updates

Quotes, trades, bars, and order books are venue-aware. Omitting `venue` identifies
the default or consolidated stream selected by the application or provider.
Provider payloads are normalized into full field names, quantities in instrument
units, and ISO 8601 timestamps before entering the rest of the system.

## Data Flow

```txt
provider adapter
      |
      v
normalized Relay event
      |
      v
MarketDataPipeline
      |----> MarketDataCache (memory or Redis)
      `----> RelayEventBus  (memory or Redis)
                         |
                         v
                  WebSocket clients
```

Clients can hydrate from cached state before subscribing to live events. Relay
keeps the cache, event bus, transport, and provider adapter behind separate
contracts so applications can replace each layer independently.

## Development

Requires Node.js 22 or later and pnpm.

```bash
pnpm install
pnpm check
pnpm lint
pnpm test:run
pnpm build
```

## Documentation

- [Core package](packages/core/README.md)
- [Redis package](packages/redis/README.md)
- [WebSocket package](packages/ws/README.md)
- [Alpaca adapter](packages/adapter-alpaca/README.md)
- [Internal engineering notes](docs/README.md)

## Status

Relay is under active development. Its public API may change before the first
stable release.

## License

MIT
