# @zagvar/relay-ws

WebSocket transport for Relay.

This package exposes cached market data hydration and live Relay messages to
WebSocket clients. The built-in server helpers target the Node `ws` package.
`RelayClientSession` remains available for applications that want to adapt a
different WebSocket implementation.

## Usage

Create a standalone WebSocket server:

```ts
import { createRelayNodeWsServer } from "@zagvar/relay-ws";

const server = createRelayNodeWsServer({
  port: 8080,
  eventBus,
  hydrator,
  onError: console.error,
});
```

Or attach Relay behavior to an existing `ws` connection:

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

Future adapters can use distinct names for other runtimes, such as Bun or
framework-specific WebSocket integrations.

## Status

Under active development. Not ready for production use.

## License

MIT
