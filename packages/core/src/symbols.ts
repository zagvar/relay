import type { MarketDataRequest } from "./market_data.js";

/** Normalizes a provider or user supplied market symbol. */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** Normalizes an optional venue identifier for stable lookup keys. */
export function normalizeVenue(venue: string): string {
  return venue.trim().toUpperCase();
}

/** Creates a stable key for a symbol and optional venue. */
export function createMarketDataRequestKey(request: MarketDataRequest): string {
  return JSON.stringify([
    normalizeSymbol(request.symbol),
    request.venue === undefined ? null : normalizeVenue(request.venue),
  ]);
}

/** Splits symbols into fixed-size batches while preserving order. */
export function chunkSymbols(symbols: readonly string[], batchSize: number): readonly string[][] {
  if (batchSize <= 0) {
    throw new Error("batchSize must be greater than zero.");
  }

  const normalizedSymbols = symbols.map(normalizeSymbol);
  const batches: string[][] = [];

  for (let i = 0; i < normalizedSymbols.length; i += batchSize) {
    batches.push(normalizedSymbols.slice(i, i + batchSize));
  }

  return batches;
}
