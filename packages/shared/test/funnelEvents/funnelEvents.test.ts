import { describe, it, expect } from "vitest";
import { FunnelEventPipeline, InMemoryFunnelEmitter } from "../../src/funnelEvents.ts";

describe("FunnelEventPipeline", () => {
  it("emits an event with a pseudonymised user ID", async () => {
    const emitter = new InMemoryFunnelEmitter();
    const pipeline = new FunnelEventPipeline(emitter, "test-salt");

    await pipeline.record("SEARCH_INITIATED", "user_real_id", "session_abc", "corr_xyz");

    expect(emitter.events).toHaveLength(1);
    const ev = emitter.events[0];
    expect(ev.pseudoUserId).not.toBe("user_real_id");
    expect(ev.pseudoUserId).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(ev.step).toBe("SEARCH_INITIATED");
  });

  it("strips PII from event properties", async () => {
    const emitter = new InMemoryFunnelEmitter();
    const pipeline = new FunnelEventPipeline(emitter, "test-salt");

    await pipeline.record("OFFER_SELECTED", "user_1", "s1", "c1", {
      email: "user@example.com",
      offerId: "offer_123",
      price: 299,
    });

    const ev = emitter.events[0];
    expect(ev.properties["email"]).toBeUndefined();
    expect(ev.properties["offerId"]).toBe("offer_123");
    expect(ev.properties["price"]).toBe(299);
  });

  it("produces different pseudo IDs for different users", async () => {
    const emitter = new InMemoryFunnelEmitter();
    const pipeline = new FunnelEventPipeline(emitter, "test-salt");

    await pipeline.record("BOOKING_CONFIRMED", "user_A", "s1", "c1");
    await pipeline.record("BOOKING_CONFIRMED", "user_B", "s2", "c2");

    expect(emitter.events[0].pseudoUserId).not.toBe(emitter.events[1].pseudoUserId);
  });
});
