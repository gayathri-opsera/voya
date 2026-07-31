/**
 * BookingExpirySweep — WO-043: Scheduled expiry sweep for abandoned PENDING bookings.
 *
 * Runs on a schedule (e.g. every minute). Finds bookings that have been in
 * PENDING status beyond the booking TTL and transitions them to EXPIRED.
 *
 * Idempotent: re-running will not expire already-expired bookings.
 */

import type { BookingLifecycleService } from "../domain/BookingLifecycleService.ts";

export interface ExpiredBookingQuery {
  findExpiredPending(olderThanMs: number): Promise<{ id: string }[]>;
}

export interface ExpiryAuditPort {
  recordExpiry(bookingId: string, reason: string): Promise<void>;
}

export class BookingExpirySweep {
  constructor(
    private readonly query: ExpiredBookingQuery,
    private readonly lifecycle: BookingLifecycleService,
    private readonly audit: ExpiryAuditPort,
    private readonly ttlMs: number = 30 * 60 * 1000, // 30 minutes default
  ) {}

  async run(): Promise<{ expired: number; errors: number }> {
    const candidates = await this.query.findExpiredPending(this.ttlMs);
    let expired = 0;
    let errors = 0;

    for (const { id } of candidates) {
      try {
        await this.lifecycle.transition(id, "EXPIRED", { role: "SYSTEM", id: "expiry-sweep" }, "TTL exceeded");
        await this.audit.recordExpiry(id, "booking_ttl_exceeded");
        expired++;
      } catch {
        errors++;
      }
    }

    return { expired, errors };
  }
}
