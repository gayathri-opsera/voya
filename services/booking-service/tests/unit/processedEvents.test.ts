import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryProcessedEventStore } from "../../src/repositories/ProcessedEventRepository.js";

describe("InMemoryProcessedEventStore - idempotency", () => {
  let store: InMemoryProcessedEventStore;

  beforeEach(() => {
    store = new InMemoryProcessedEventStore();
  });

  it("inserts an event and returns duplicate=false on first occurrence", async () => {
    const result = await store.insert({
      provider: "stripe",
      eventId: "evt_001",
      eventType: "payment_intent.succeeded",
    });
    expect(result.duplicate).toBe(false);
  });

  it("returns duplicate=true on second insert with same (provider, event_id)", async () => {
    await store.insert({ provider: "stripe", eventId: "evt_001", eventType: "payment_intent.succeeded" });
    const result = await store.insert({ provider: "stripe", eventId: "evt_001", eventType: "payment_intent.succeeded" });
    expect(result.duplicate).toBe(true);
  });

  it("allows same event_id from different providers", async () => {
    await store.insert({ provider: "stripe", eventId: "evt_001", eventType: "payment_intent.succeeded" });
    const result = await store.insert({ provider: "amadeus", eventId: "evt_001", eventType: "booking.confirmed" });
    expect(result.duplicate).toBe(false);
  });

  it("stores payload_digest", async () => {
    const result = await store.insert({
      provider: "stripe",
      eventId: "evt_002",
      eventType: "charge.refunded",
      payloadDigest: "sha256:abc123",
    });
    if (!result.duplicate) {
      expect(result.event.payloadDigest).toBe("sha256:abc123");
    }
  });
});
