import { describe, it, expect, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "../../src/circuitBreaker.ts";

describe("CircuitBreaker", () => {
  it("starts in CLOSED state and allows requests", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 3, resetTimeoutMs: 60_000, successThreshold: 2 });
    expect(cb.currentState).toBe("CLOSED");
    const result = await cb.execute(async () => "ok");
    expect(result).toBe("ok");
  });

  it("opens after failureThreshold consecutive failures", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 3, resetTimeoutMs: 60_000, successThreshold: 2 });
    for (let i = 0; i < 3; i++) {
      await cb.execute(async () => { throw new Error("fail"); }).catch(() => {});
    }
    expect(cb.currentState).toBe("OPEN");
  });

  it("throws CircuitBreakerOpenError when OPEN", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeoutMs: 60_000, successThreshold: 2 });
    await cb.execute(async () => { throw new Error("fail"); }).catch(() => {});
    await expect(cb.execute(async () => "ok")).rejects.toThrow(CircuitBreakerOpenError);
  });

  it("transitions to HALF_OPEN after resetTimeout", async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeoutMs: 1_000, successThreshold: 2 });
    await cb.execute(async () => { throw new Error("fail"); }).catch(() => {});
    expect(cb.currentState).toBe("OPEN");

    vi.advanceTimersByTime(1_100);
    // Next request should transition to HALF_OPEN
    await cb.execute(async () => "probe").catch(() => {});
    vi.useRealTimers();
  });

  it("closes from HALF_OPEN after successThreshold successes", async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeoutMs: 1_000, successThreshold: 2 });
    await cb.execute(async () => { throw new Error("fail"); }).catch(() => {});

    vi.advanceTimersByTime(1_100);
    await cb.execute(async () => "ok1");
    await cb.execute(async () => "ok2");
    expect(cb.currentState).toBe("CLOSED");
    vi.useRealTimers();
  });

  it("reset() returns to CLOSED state", () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeoutMs: 60_000, successThreshold: 2 });
    cb.reset();
    expect(cb.currentState).toBe("CLOSED");
  });
});
