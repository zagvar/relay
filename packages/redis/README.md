# @zagvar/relay-redis

Redis-backed implementations for Relay.

This package will provide Redis implementations of Relay cache and event bus contracts.

## Cache Model

`@zagvar/relay-redis` is intended for hot market data caching, not durable historical storage.

Redis is a good fit for:

- latest trades
- latest market summaries
- current market clock
- recent bar series
- pub/sub fan-out

Longer chart history should usually come from a provider API, database, object storage, or a dedicated historical bar store. Applications can use Redis for fast recent reads and fall back to their own historical source when more data is needed.

## Status

Under active development. Not ready for production use.

## License

MIT
