/** Normalizes a provider or user supplied market symbol. */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
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
