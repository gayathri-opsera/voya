/**
 * WebhookProcessorService — exactly-once webhook processing.
 *
 * Uses the processed_events table (WO-072) as the durable idempotency authority.
 * Redis provides a fast hot-path check; the DB constraint is the final authority.
 *
 * Flow:
 *   1. Verify Stripe signature (caller responsibility)
 *   2. Check processed_events for duplicate (DB unique constraint)
 *   3. If new: process event, update booking/payment state
 *   4. If duplicate: return idempotent success (no re-processing)
 */

export interface ProcessedEventStorePort {
  insert(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payloadDigest?: string;
  }): Promise<{ duplicate: false; event: { id: string } } | { duplicate: true; existingId: string }>;
}

export interface WebhookEvent {
  provider: "stripe" | "amadeus" | string;
  eventId: string;
  eventType: string;
  payload: unknown;
  payloadDigest?: string;
}

export type WebhookProcessingResult =
  | { outcome: "processed"; bookingId?: string }
  | { outcome: "duplicate"; existingId: string }
  | { outcome: "ignored"; reason: string };

export type EventHandler = (
  payload: unknown,
) => Promise<{ bookingId?: string }>;

export interface WebhookProcessorDeps {
  eventStore: ProcessedEventStorePort;
  handlers: Record<string, EventHandler>;
}

export class WebhookProcessorService {
  constructor(private readonly deps: WebhookProcessorDeps) {}

  async process(event: WebhookEvent): Promise<WebhookProcessingResult> {
    // Idempotency check via durable constraint
    const storeResult = await this.deps.eventStore.insert({
      provider: event.provider,
      eventId: event.eventId,
      eventType: event.eventType,
      payloadDigest: event.payloadDigest,
    });

    if (storeResult.duplicate) {
      return { outcome: "duplicate", existingId: storeResult.existingId };
    }

    // Find handler for this event type
    const handler = this.deps.handlers[event.eventType];
    if (!handler) {
      return { outcome: "ignored", reason: `No handler for event type: ${event.eventType}` };
    }

    const result = await handler(event.payload);
    return { outcome: "processed", bookingId: result.bookingId };
  }
}
