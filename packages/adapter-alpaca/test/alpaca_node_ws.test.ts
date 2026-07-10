import { describe, expect, it } from "vitest";
import { createAlpacaStockStreamUrl } from "../src/index.js";

describe("Alpaca Node ws helpers", () => {
  it("builds stock stream URLs for v2 feeds", () => {
    expect(createAlpacaStockStreamUrl({ feed: "iex" })).toBe(
      "wss://stream.data.alpaca.markets/v2/iex",
    );

    expect(createAlpacaStockStreamUrl({ feed: "sip" })).toBe(
      "wss://stream.data.alpaca.markets/v2/sip",
    );

    expect(createAlpacaStockStreamUrl({ feed: "delayed_sip" })).toBe(
      "wss://stream.data.alpaca.markets/v2/delayed_sip",
    );
  });

  it("builds stock stream URLs for beta feeds", () => {
    expect(createAlpacaStockStreamUrl({ feed: "boats" })).toBe(
      "wss://stream.data.alpaca.markets/v1beta1/boats",
    );

    expect(createAlpacaStockStreamUrl({ feed: "overnight" })).toBe(
      "wss://stream.data.alpaca.markets/v1beta1/overnight",
    );
  });

  it("builds the always-available test stream URL", () => {
    expect(createAlpacaStockStreamUrl({ feed: "test" })).toBe(
      "wss://stream.data.alpaca.markets/v2/test",
    );
  });

  it("builds sandbox URLs", () => {
    expect(createAlpacaStockStreamUrl({ feed: "iex", sandbox: true })).toBe(
      "wss://stream.data.sandbox.alpaca.markets/v2/iex",
    );
  });
});
