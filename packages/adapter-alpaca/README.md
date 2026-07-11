# @zagvar/relay-adapter-alpaca

Alpaca market data adapter for Relay.

This package maps Alpaca market data messages into provider-neutral Relay core
types. It is intended both as a useful Alpaca integration and as a reference
adapter for developers bringing their own market data provider.

## Usage

Map one raw Alpaca websocket payload into Relay market events:

```ts
import { parseAlpacaStockMarketEvents } from "@zagvar/relay-adapter-alpaca";

const marketEvents = parseAlpacaStockMarketEvents(rawMessage);
```

Connect to Alpaca's stock market data stream with Node `ws`:

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

The adapter emits Relay `MarketTrade`, `MarketQuote`, and `MarketBar` events.
Applications can pass those events to `MarketDataPipeline`, publish them to
Redis, or handle them directly.

## Smoke Test

The package includes a manual smoke script for Alpaca's always-available test
stream.

Create a local `.env` file at the repository root:

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

The default smoke configuration connects to `wss://stream.data.alpaca.markets/v2/test`
and subscribes to `FAKEPACA`. Real feeds such as `iex`, `sip`, and `delayed_sip`
use the same code path but depend on Alpaca account permissions.

## Notes

- Alpaca stock quote sizes are reported in round lots. Relay normalizes them to
  share quantities.
- The Node websocket helper targets the npm `ws` package.
- The parser and mapper functions are pure and can be used without opening a
  websocket connection.

## Status

Under active development. Not ready for production use.

## License

MIT
