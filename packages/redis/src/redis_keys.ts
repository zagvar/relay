import { normalizeSymbol } from "@zagvar/relay-core";

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

  latestTrades(): string {
    return `${this.#prefix}:market:latest_trades`;
  }

  marketSummaries(): string {
    return `${this.#prefix}:market:summaries`;
  }

  marketClock(): string {
    return `${this.#prefix}:market:clock`;
  }

  bars(symbol: string, timeframe: string): string {
    return `${this.#prefix}:market:bars:${normalizeSymbol(symbol)}:${timeframe}`;
  }

  eventChannel(channel: string): string {
    return `${this.#prefix}:events:${channel}`;
  }
}
