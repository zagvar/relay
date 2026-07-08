import { describe, expect, it } from "vitest";
import { calculateReconnectDelay } from "../src/reconnect.js";

describe("calculateReconnectDelay", () => {
  it("calculates capped exponential delays", () => {
    expect(calculateReconnectDelay(0)).toBe(1_000);
    expect(calculateReconnectDelay(1)).toBe(2_000);
    expect(calculateReconnectDelay(5)).toBe(30_000);
  });

  it("supports custom backoff options", () => {
    expect(
      calculateReconnectDelay(2, {
        initialDelayMs: 500,
        maxDelayMs: 10_000,
        multiplier: 3,
      }),
    ).toBe(4_500);
  });
});
