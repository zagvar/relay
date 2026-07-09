import { describe, expect, it } from "vitest";
import {
  PROVIDER_CAPABILITY,
  assertProviderCapability,
  hasProviderCapability,
} from "../src/provider_capability.js";

describe("hasProviderCapability", () => {
  it("returns true for supported capabilities", () => {
    expect(
      hasProviderCapability({ marketSummaries: true }, PROVIDER_CAPABILITY.marketSummaries),
    ).toBe(true);
  });

  it("returns false for unsupported capabilities", () => {
    expect(hasProviderCapability({ marketSummaries: true }, PROVIDER_CAPABILITY.liveTrades)).toBe(
      false,
    );
  });
});

describe("assertProviderCapability", () => {
  it("does not throw for supported capabilities", () => {
    expect(() =>
      assertProviderCapability("demo", { liveBars: true }, PROVIDER_CAPABILITY.liveBars),
    ).not.toThrow();
  });

  it("throws for unsupported capabilities", () => {
    expect(() =>
      assertProviderCapability("demo", { marketSummaries: true }, PROVIDER_CAPABILITY.marketClock),
    ).toThrow("demo does not support market_clock.");
  });
});
