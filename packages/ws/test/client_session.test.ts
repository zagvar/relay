import { describe, expect, it } from "vitest";
import {
  MARKET_EVENT_CHANNEL,
  MarketDataHydrator,
  MemoryMarketDataCache,
  MemoryRelayEventBus,
  createRelayMessage,
  type MarketBar,
  type MarketQuote,
  type MarketSummary,
  type MarketTrade,
  type OrderBookSnapshot,
  type OrderBookUpdate,
} from "@zagvar/relay-core";
import { RelayClientSession } from "../src/client_session.js";
import type { RelaySocket } from "../src/socket.js";

class FakeSocket implements RelaySocket {
  readonly sentMessages: string[] = [];

  send(message: string): void {
    this.sentMessages.push(message);
  }

  get sentPayloads(): unknown[] {
    return this.sentMessages.map((message) => JSON.parse(message) as unknown);
  }
}

describe("RelayClientSession", () => {
  it("forwards subscribed market summaries until unsubscribed", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const aaplSummary: MarketSummary = {
      symbol: "AAPL",
      assetClass: "equity",
      price: 195.12,
      previousClose: 190,
    };
    const msftSummary: MarketSummary = {
      symbol: "MSFT",
      assetClass: "equity",
      price: 420.5,
      previousClose: 415,
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_market_summaries",
        symbols: ["AAPL"],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.marketSummary, aaplSummary));
    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.marketSummary, msftSummary));

    await session.handleMessage(
      JSON.stringify({
        type: "unsubscribe_market_summaries",
        symbols: ["AAPL"],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.marketSummary, aaplSummary));

    expect(socket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "market_summary",
          data: aaplSummary,
        },
      },
    ]);
  });

  it("forwards subscribed quotes until unsubscribed", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const quote: MarketQuote = {
      type: "quote",
      symbol: "AAPL",
      assetClass: "equity",
      venue: "NASDAQ",
      bidPrice: 195.1,
      bidQuantity: 200,
      askPrice: 195.12,
      askQuantity: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_quotes",
        quotes: [{ symbol: "AAPL", venue: "NASDAQ" }],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.quote, quote));

    await session.handleMessage(
      JSON.stringify({
        type: "unsubscribe_quotes",
        quotes: [{ symbol: "AAPL", venue: "NASDAQ" }],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.quote, quote));

    expect(socket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "quote",
          data: quote,
        },
      },
    ]);
  });

  it("forwards subscribed trade messages", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      assetClass: "equity",
      price: 195.12,
      quantity: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_trades",
        trades: [{ symbol: "AAPL" }],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(socket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "trade",
          data: trade,
        },
      },
    ]);
  });

  it("forwards trades only for the subscribed venue", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({
      socket,
      eventBus,
    });

    const coinbaseTrade: MarketTrade = {
      type: "trade",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      price: 65_000.5,
      quantity: 0.1,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    const binanceTrade: MarketTrade = {
      ...coinbaseTrade,
      venue: "BINANCE",
      price: 65_002.5,
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_trades",
        trades: [
          {
            symbol: "BTC/USDT",
            venue: "COINBASE",
          },
        ],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, binanceTrade));

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, coinbaseTrade));

    expect(socket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "trade",
          data: coinbaseTrade,
        },
      },
    ]);
  });

  it("does not forward unsubscribed trade messages", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const trade: MarketTrade = {
      type: "trade",
      symbol: "MSFT",
      assetClass: "equity",
      price: 420.5,
      quantity: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_trades",
        trades: [{ symbol: "AAPL" }],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(socket.sentPayloads).toEqual([]);
  });

  it("forwards order-book events only for the subscribed venue", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({
      socket,
      eventBus,
    });

    const coinbaseSnapshot: OrderBookSnapshot = {
      type: "order_book_snapshot",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: [{ price: 65_000, quantity: 1.25 }],
      asks: [{ price: 65_001, quantity: 0.8 }],
      timestamp: "2026-01-01T14:30:00.000Z",
      sequence: 100,
    };

    const binanceSnapshot: OrderBookSnapshot = {
      ...coinbaseSnapshot,
      venue: "BINANCE",
      bids: [{ price: 65_002, quantity: 1.5 }],
      asks: [{ price: 65_003, quantity: 0.9 }],
    };

    const coinbaseUpdate: OrderBookUpdate = {
      type: "order_book_update",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: [{ price: 65_000, quantity: 2 }],
      asks: [{ price: 65_001, quantity: 0 }],
      timestamp: "2026-01-01T14:30:01.000Z",
      sequence: 101,
      previousSequence: 100,
      reset: false,
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_order_books",
        orderBooks: [
          {
            symbol: "BTC/USDT",
            venue: "COINBASE",
          },
        ],
      }),
    );

    // Same symbol, wrong venue: must not be forwarded.
    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.orderBook, binanceSnapshot));

    // Matching snapshot and update: both must be forwarded.
    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.orderBook, coinbaseSnapshot));

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.orderBook, coinbaseUpdate));

    await session.handleMessage(
      JSON.stringify({
        type: "unsubscribe_order_books",
        orderBooks: [
          {
            symbol: "BTC/USDT",
            venue: "COINBASE",
          },
        ],
      }),
    );

    // Matching venue after unsubscribe: must not be forwarded.
    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.orderBook, coinbaseUpdate));

    expect(socket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "order_book",
          data: coinbaseSnapshot,
        },
      },
      {
        type: "relay_message",
        data: {
          channel: "order_book",
          data: coinbaseUpdate,
        },
      },
    ]);
  });

  it("forwards subscribed bar messages", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const bar: MarketBar = {
      type: "bar",
      symbol: "AAPL",
      assetClass: "equity",
      timeframe: "1Min",
      open: 190,
      high: 196,
      low: 189,
      close: 195,
      volume: 120_000,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_bars",
        bars: [{ symbol: "AAPL", timeframe: "1Min" }],
      }),
    );

    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.bar, bar));

    expect(socket.sentPayloads).toEqual([
      {
        type: "relay_message",
        data: {
          channel: "bar",
          data: bar,
        },
      },
    ]);
  });

  it("sends hydration payloads", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const session = new RelayClientSession({ socket, eventBus, hydrator });

    await cache.setMarketSummaries({
      AAPL: {
        symbol: "AAPL",
        assetClass: "equity",
        price: 195.12,
      },
    });

    await session.handleMessage(
      JSON.stringify({
        type: "hydrate",
        request: {
          symbols: ["AAPL"],
          includeMarketSummaries: true,
        },
      }),
    );

    expect(socket.sentPayloads).toEqual([
      {
        type: "hydration",
        data: {
          marketSummaries: {
            AAPL: {
              symbol: "AAPL",
              assetClass: "equity",
              price: 195.12,
            },
          },
        },
      },
    ]);
  });

  it("sends cached venue-specific order books during hydration", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const cache = new MemoryMarketDataCache();
    const hydrator = new MarketDataHydrator(cache);
    const session = new RelayClientSession({
      socket,
      eventBus,
      hydrator,
    });

    const coinbaseSnapshot: OrderBookSnapshot = {
      type: "order_book_snapshot",
      symbol: "BTC/USDT",
      assetClass: "crypto",
      venue: "COINBASE",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: [{ price: 65_000, quantity: 1.25 }],
      asks: [{ price: 65_001, quantity: 0.8 }],
      timestamp: "2026-01-01T14:30:00.000Z",
      sequence: 100,
    };

    await cache.setOrderBookSnapshot(coinbaseSnapshot);

    await session.handleMessage(
      JSON.stringify({
        type: "hydrate",
        request: {
          orderBooks: [
            {
              symbol: "BTC/USDT",
              venue: "COINBASE",
            },
            {
              symbol: "BTC/USDT",
              venue: "BINANCE",
            },
          ],
        },
      }),
    );

    expect(socket.sentPayloads).toEqual([
      {
        type: "hydration",
        data: {
          orderBookSnapshots: [coinbaseSnapshot],
        },
      },
    ]);
  });

  it("stops forwarding after close", async () => {
    const socket = new FakeSocket();
    const eventBus = new MemoryRelayEventBus();
    const session = new RelayClientSession({ socket, eventBus });
    const trade: MarketTrade = {
      type: "trade",
      symbol: "AAPL",
      assetClass: "equity",
      price: 195.12,
      quantity: 100,
      timestamp: "2026-01-01T14:30:00.000Z",
    };

    await session.start();

    await session.handleMessage(
      JSON.stringify({
        type: "subscribe_trades",
        trades: [{ symbol: "AAPL" }],
      }),
    );

    await session.close();
    await eventBus.publish(createRelayMessage(MARKET_EVENT_CHANNEL.trade, trade));

    expect(socket.sentPayloads).toEqual([]);
  });
});
