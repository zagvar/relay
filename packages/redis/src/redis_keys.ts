import {
  createMarketDataRequestKey,
  normalizeSymbol,
  type BarsRequest,
  type MarketDataRequest,
} from "@zagvar/relay-core";

/** Options used to namespace Relay Redis keys. */
export interface RelayRedisKeyOptions {
  readonly prefix?: string;
}

/** Creates stable Redis keys for Relay market data. */
export class RelayRedisKeys {
  readonly #prefix: string;

  constructor(options: RelayRedisKeyOptions = {}) {
    this.#prefix = options.prefix ?? "relay";
  }

  latestQuotes(): string {
    return `${this.#prefix}:market:latest_quotes`;
  }

  latestTrades(): string {
    return `${this.#prefix}:market:latest_trades`;
  }

  marketDataField(request: MarketDataRequest): string {
    return createMarketDataRequestKey(request);
  }

  orderBookSnapshot(request: MarketDataRequest): string {
    const symbol = encodeURIComponent(normalizeSymbol(request.symbol));

    const venue = encodeURIComponent(request.venue?.trim().toUpperCase() ?? "default");

    return `${this.#prefix}:market:order_book:${symbol}:${venue}`;
  }

  marketSummaries(): string {
    return `${this.#prefix}:market:summaries`;
  }

  marketClock(): string {
    return `${this.#prefix}:market:clock`;
  }

  bars(request: BarsRequest): string {
    const identity = encodeURIComponent(createMarketDataRequestKey(request));
    const timeframe = encodeURIComponent(request.timeframe);

    return `${this.#prefix}:market:bars:${identity}:${timeframe}`;
  }

  eventChannel(channel: string): string {
    return `${this.#prefix}:events:${channel}`;
  }
}
