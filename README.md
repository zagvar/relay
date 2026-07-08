# Relay

Relay is an early-stage TypeScript toolkit for building provider-neutral market data pipelines for trading and fintech applications.

The project is being extracted from production-shaped backend patterns used for market data ingestion, caching, pub/sub fan-out, and client-facing realtime updates. The package descriptions and public API will become more specific as the first packages settle.

## Planned Packages

- `@zagvar/relay-core`: provider-neutral contracts, event channels, cache interfaces, pipeline helpers, and utilities.
- `@zagvar/relay-redis`: Redis-backed cache and pub/sub implementations.
- `@zagvar/relay-ws`: websocket fan-out for browser and app clients.
- `@zagvar/relay-adapter-alpaca`: Alpaca market data adapter.

## Status

Relay is under active development and is not ready for production use yet.

## Development

```bash
pnpm install
pnpm check
pnpm lint
pnpm test:run
pnpm build
```
