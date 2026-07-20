# @zagvar/relay-ws

Cached hydration and live Relay market data over WebSockets.

The built-in server helpers target Node's `ws` package. `RelayClientSession`
contains the transport-independent session behavior for applications integrating
another WebSocket implementation.

## Server

Create a standalone server:

```ts
import { createRelayNodeWsServer } from "@zagvar/relay-ws";

const server = createRelayNodeWsServer({
  port: 8080,
  eventBus,
  hydrator,
  onError: console.error,
});
```

Or attach Relay to an existing `ws` connection:

```ts
import { WebSocketServer } from "ws";
import { attachRelayNodeWsConnection } from "@zagvar/relay-ws";

const server = new WebSocketServer({ port: 8080 });

server.on("connection", (websocket) => {
  void attachRelayNodeWsConnection({
    websocket,
    eventBus,
    hydrator,
    onError: console.error,
  });
});
```

## Hydration

A client can request cached state before subscribing to live updates:

```json
{
  "type": "hydrate",
  "request": {
    "quotes": [{ "symbol": "BTC/USD", "venue": "COINBASE" }],
    "trades": [{ "symbol": "BTC/USD", "venue": "COINBASE" }],
    "bars": [{ "symbol": "BTC/USD", "venue": "COINBASE", "timeframe": "1m" }],
    "orderBooks": [{ "symbol": "BTC/USD", "venue": "COINBASE" }]
  }
}
```

The server responds with a message whose `type` is `"hydration"`. Missing cache
entries are omitted; the WebSocket layer does not fetch from a provider.

## Live Subscriptions

Venue-aware live subscriptions use request objects:

```json
{
  "type": "subscribe_quotes",
  "quotes": [{ "symbol": "BTC/USD", "venue": "COINBASE" }]
}
```

Equivalent message pairs are available for:

- `subscribe_trades` / `unsubscribe_trades`
- `subscribe_bars` / `unsubscribe_bars`
- `subscribe_order_books` / `unsubscribe_order_books`

Bars also require `timeframe`. Market summaries use a `symbols` array, while
low-level channel subscriptions use a `channels` array.

An omitted venue addresses the default or consolidated stream. It does not
subscribe the client to events from every venue. The session filters each live
event against the client's exact normalized subscription key.

## Message Validation

`parseRelayClientMessage` parses incoming JSON through strict runtime schemas.
Invalid JSON, unsupported message types, unknown properties, duplicate
subscriptions, and excessive request cardinality are rejected before session
state changes.

Client messages are limited to 64 KiB. `createRelayNodeWsServer` applies this
limit through the `ws` `maxPayload` option as well as application-level parsing.
When attaching Relay to an existing `WebSocketServer`, configure that server
with `maxPayload: RELAY_CLIENT_MESSAGE_MAX_BYTES`.

## Connection Limits

Each session accepts at most 2,000 distinct subscriptions by default. Outbound
sends are serialized, and a connection is closed when its queued transport data
plus the next message would exceed the default 8 MiB buffer. Configure
`maxSubscriptions` and `maxBufferedBytes` per server or attached connection when
your application needs different limits.

## Status

Under active development. The public API and wire protocol may change before the
first stable release.

## License

MIT
