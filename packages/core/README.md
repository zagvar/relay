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
- Symbol batching and normalization
- Reconnect and throttling utilities

## Status

This package is under active development. The public API may change before the first stable release.

## License

MIT
