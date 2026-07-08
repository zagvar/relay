import { describe, expect, it } from "vitest";
import { chunkSymbols, normalizeSymbol } from "../src/symbols.js";

describe("normalizeSymbol", () => {
  it("trims and uppercases symbols", () => {
    expect(normalizeSymbol(" aapl ")).toBe("AAPL");
  });
});

describe("chunkSymbols", () => {
  it("splits symbols into fixed-size batches", () => {
    expect(chunkSymbols(["aapl", "msft", "nvda"], 2)).toEqual([["AAPL", "MSFT"], ["NVDA"]]);
  });

  it("rejects invalid batch sizes", () => {
    expect(() => chunkSymbols(["AAPL"], 0)).toThrow("batchSize must be greater than zero.");
  });
});
