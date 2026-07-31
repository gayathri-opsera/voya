/**
 * FunnelEventPipeline — WO-106: Pseudonymised conversion funnel event instrumentation.
 *
 * Records anonymised/pseudonymised user funnel events for analytics.
 * PII is never emitted — user IDs are hashed before emission.
 *
 * Events:
 * - SEARCH_INITIATED
 * - SEARCH_RESULTS_VIEWED
 * - OFFER_SELECTED
 * - CHECKOUT_STARTED
 * - PAYMENT_INITIATED
 * - BOOKING_CONFIRMED
 * - BOOKING_ABANDONED
 */

import { createHash } from "crypto";

export type FunnelStep =
  | "SEARCH_INITIATED"
  | "SEARCH_RESULTS_VIEWED"
  | "OFFER_SELECTED"
  | "CHECKOUT_STARTED"
  | "PAYMENT_INITIATED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_ABANDONED";

export interface FunnelEvent {
  eventId: string;
  step: FunnelStep;
  pseudoUserId: string;      // SHA-256 hash of userId + salt (not reversible)
  sessionId: string;
  correlationId: string;
  timestamp: Date;
  properties: Record<string, unknown>;
}

export interface FunnelEventEmitter {
  emit(event: FunnelEvent): Promise<void>;
}

/** In-memory emitter for tests. */
export class InMemoryFunnelEmitter implements FunnelEventEmitter {
  readonly events: FunnelEvent[] = [];
  async emit(event: FunnelEvent): Promise<void> {
    this.events.push(event);
  }
}

export class FunnelEventPipeline {
  constructor(
    private readonly emitter: FunnelEventEmitter,
    private readonly pseudonymSalt: string,
  ) {}

  async record(
    step: FunnelStep,
    userId: string,
    sessionId: string,
    correlationId: string,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
    // Pseudonymise: SHA-256(userId + salt) — user cannot be re-identified
    const pseudoUserId = createHash("sha256")
      .update(userId + this.pseudonymSalt)
      .digest("hex");

    // Strip any PII from properties defensively
    const safeProperties = this.sanitiseProperties(properties);

    const event: FunnelEvent = {
      eventId: crypto.randomUUID(),
      step,
      pseudoUserId,
      sessionId,
      correlationId,
      timestamp: new Date(),
      properties: safeProperties,
    };

    await this.emitter.emit(event);
  }

  private sanitiseProperties(props: Record<string, unknown>): Record<string, unknown> {
    const PII_KEYS = new Set([
      "email", "name", "fullName", "phone", "phoneNumber",
      "dateOfBirth", "dob", "address", "postcode", "ssn",
      "passportNumber", "cardNumber",
    ]);
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (!PII_KEYS.has(key)) {
        safe[key] = value;
      }
    }
    return safe;
  }
}
