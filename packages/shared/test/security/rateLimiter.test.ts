import { describe, it, expect, beforeEach } from "vitest";
import {
  RateLimiter,
  InMemoryRateLimitStore,
  DEFAULT_RATE_LIMITS,
} from "../../src/rateLimiter.ts";

describe("RateLimiter", () => {
  let store: InMemoryRateLimitStore;
  let limiter: RateLimiter;

  beforeEach(() => {
    store = new InMemoryRateLimitStore();
    limiter = new RateLimiter(store);
  });

  it("allows requests within limit", async () => {
    const result = await limiter.check("user_123", "authenticated");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(119); // 120 - 1
  });

  it("blocks requests exceeding limit and returns Retry-After", async () => {
    // Exhaust the anonymous limit (30 req/min)
    for (let i = 0; i < 30; i++) {
      await limiter.check("anon_ip", "anonymous");
    }
    const result = await limiter.check("anon_ip", "anonymous");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
    expect(result.remaining).toBe(0);
  });

  it("service tier is not rate limited", async () => {
    for (let i = 0; i < 1000; i++) {
      const result = await limiter.check("service_key", "service");
      expect(result.allowed).toBe(true);
    }
  });

  it("different keys are tracked independently", async () => {
    // Exhaust one key
    for (let i = 0; i < 30; i++) {
      await limiter.check("ip_A", "anonymous");
    }
    const resultA = await limiter.check("ip_A", "anonymous");
    const resultB = await limiter.check("ip_B", "anonymous");

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });
});
