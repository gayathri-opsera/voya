import { describe, it, expect, beforeEach } from "vitest";
import { WebhookProcessorService } from "../../src/domain/WebhookProcessorService.js";
// Local lightweight store to avoid cross-service import
class InMemoryProcessedEventStore {
  private readonly store = new Map<string, { id: string }>();
  async insert(input: { provider: string; eventId: string; eventType: string; payloadDigest?: string }) {
    const key = `${input.provider}:${input.eventId}`;
    const existing = this.store.get(key);
    if (existing) return { duplicate: true as const, existingId: existing.id };
    const event = { id: Math.random().toString(36).slice(2) };
    this.store.set(key, event);
    return { duplicate: false as const, event };
  }
  clear() { this.store.clear(); }
}

describe("WebhookProcessorService — exactly-once processing", () => {
  let store: InMemoryProcessedEventStore;
  let svc: WebhookProcessorService;
  const processed: string[] = [];

  beforeEach(() => {
    store = new InMemoryProcessedEventStore();
    processed.length = 0;
    svc = new WebhookProcessorService({
      eventStore: store,
      handlers: {
        "payment_intent.succeeded": async (payload) => {
          processed.push((payload as Record<string, string>).bookingId ?? "unknown");
          return { bookingId: (payload as Record<string, string>).bookingId };
        },
      },
    });
  });

  it("processes a new event and returns processed outcome", async () => {
    const result = await svc.process({
      provider: "stripe",
      eventId: "evt_001",
      eventType: "payment_intent.succeeded",
      payload: { bookingId: "b1" },
    });
    expect(result.outcome).toBe("processed");
    expect(processed).toContain("b1");
  });

  it("returns duplicate outcome for same (provider, eventId)", async () => {
    await svc.process({
      provider: "stripe",
      eventId: "evt_002",
      eventType: "payment_intent.succeeded",
      payload: { bookingId: "b2" },
    });

    const result = await svc.process({
      provider: "stripe",
      eventId: "evt_002",
      eventType: "payment_intent.succeeded",
      payload: { bookingId: "b2" },
    });
    expect(result.outcome).toBe("duplicate");
    expect(processed).toHaveLength(1); // handler only called once
  });

  it("returns ignored outcome for unhandled event types", async () => {
    const result = await svc.process({
      provider: "stripe",
      eventId: "evt_003",
      eventType: "charge.refunded",
      payload: {},
    });
    expect(result.outcome).toBe("ignored");
  });

  it("allows same eventId from different providers", async () => {
    await svc.process({
      provider: "stripe",
      eventId: "evt_004",
      eventType: "payment_intent.succeeded",
      payload: { bookingId: "b4" },
    });
    const result = await svc.process({
      provider: "amadeus",
      eventId: "evt_004",
      eventType: "payment_intent.succeeded",
      payload: { bookingId: "b4" },
    });
    expect(result.outcome).toBe("processed");
  });
});
