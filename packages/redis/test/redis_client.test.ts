import type { createClient } from "redis";
import { describe, expectTypeOf, it } from "vitest";
import type { RedisCacheClient } from "../src/redis_client.js";

describe("RedisCacheClient", () => {
  it("accepts the node-redis client contract", () => {
    expectTypeOf<ReturnType<typeof createClient>>().toExtend<RedisCacheClient>();
  });
});
