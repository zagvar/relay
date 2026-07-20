# @zagvar/relay-adapter-alpaca

Alpaca stock market-data adapter for Relay.

The package maps Alpaca WebSocket payloads into provider-neutral Relay events. It
is both a usable Alpaca integration and a reference for implementing another
provider adapter.

## Supported Data

The current stock stream adapter supports:

- trades
- best bid and ask quotes
- bars

It does not currently provide market summaries, historical bars, market clocks,
or order-book snapshots and updates through Relay's `MarketDataProvider`
interface.

## Parsing

Map a raw Alpaca WebSocket payload without opening a connection:

```ts
import { parseAlpacaStockMarketEvents } from "@zagvar/relay-adapter-alpaca";

const marketEvents = parseAlpacaStockMarketEvents(rawMessage);
```

The parser and mapper functions are pure, so they can be tested or integrated
with an application-managed connection.

## Stock Stream

```ts
import { createAlpacaNodeWsStockClient } from "@zagvar/relay-adapter-alpaca";

const connection = createAlpacaNodeWsStockClient({
  feed: "iex",
  credentials: {
    keyId: process.env.ALPACA_API_KEY_ID ?? "",
    secretKey: process.env.ALPACA_API_SECRET_KEY ?? "",
  },
  onMarketEvent: async (event) => {
    await pipeline.processEvent(event);
  },
  onError: console.error,
});

await connection.client.subscribe({
  trades: ["AAPL"],
  quotes: ["AAPL"],
  bars: ["AAPL"],
});
```

The Node helper targets the npm `ws` package. Authentication and feed access
depend on the configured Alpaca account.

## Normalization

Alpaca field names are mapped to Relay's public names, including `price`,
`quantity`, `bidPrice`, and `askPrice`. Provider timestamps remain ISO 8601
strings, and the source exchange code is retained as the event's `venue`.

Numeric provider tokens are parsed losslessly and converted to Relay's canonical
decimal strings before they cross the adapter boundary. This avoids precision
loss from an intermediate JavaScript `number` conversion.

Alpaca stock quote sizes are reported in round lots. The adapter converts them
to share quantities so downstream consumers do not depend on Alpaca's lot-size
convention. Zero-sized quotes remain valid and map to `"0"`.

## Smoke Test

Create a local `.env` at the repository root:

```bash
ALPACA_API_KEY_ID=
ALPACA_API_SECRET_KEY=
ALPACA_STOCK_FEED=test
ALPACA_STOCK_SYMBOL=FAKEPACA
ALPACA_STOCK_STREAM_BASE_URL=
```

Then run:

```bash
pnpm --filter @zagvar/relay-adapter-alpaca smoke:stocks
```

The default configuration connects to Alpaca's `v2/test` stream and subscribes
to `FAKEPACA`. Feeds such as `iex`, `sip`, and `delayed_sip` use the same client
path but depend on account permissions.

## Status

Under active development. The public API may change before the first stable
release.

## License

MIT
