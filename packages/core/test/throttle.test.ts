import { describe, expect, it } from "vitest";
import { EventThrottle } from "../src/throttle.js";

describe("EventThrottle", () => {
  it("allows the first event for a key", () => {
    const throttle = new EventThrottle(500);

    expect(throttle.shouldEmit("AAPL", 1_000)).toBe(true);
  });

  it("blocks events inside the throttle window", () => {
    const throttle = new EventThrottle(500);

    expect(throttle.shouldEmit("AAPL", 1_000)).toBe(true);
    expect(throttle.shouldEmit("AAPL", 1_200)).toBe(false);
  });

  it("allows events after the throttle window", () => {
    const throttle = new EventThrottle(500);

    expect(throttle.shouldEmit("AAPL", 1_000)).toBe(true);
    expect(throttle.shouldEmit("AAPL", 1_500)).toBe(true);
  });

  it("prunes stale keys", () => {
    const throttle = new EventThrottle(500);

    throttle.shouldEmit("AAPL", 1_000);
    throttle.shouldEmit("MSFT", 2_000);

    expect(throttle.prune(3_000, 1_500)).toBe(1);
  });
});
