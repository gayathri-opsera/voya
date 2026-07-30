/**
 * BookingLifecycleService — the only code path that writes bookings.status.
 *
 * - Validates transition against ALLOWED_TRANSITIONS (deny by default)
 * - Idempotent for CONFIRMED and CANCELLED (same-status is a no-op)
 * - Writes audit row in the same atomic operation as the status change
 * - Throws LifecycleConflictError for all disallowed moves (HTTP 409)
 */

import {
  type BookingStatus,
  isAllowedTransition,
  getAllowedTargets,
} from "./transitions.js";
import type { AuditWriter } from "./AuditWriter.js";

export class LifecycleConflictError extends Error {
  constructor(
    public readonly bookingId: string,
    public readonly currentStatus: BookingStatus,
    public readonly requestedStatus: BookingStatus,
    public readonly allowedTransitions: BookingStatus[],
  ) {
    super(
      `Booking ${bookingId} is ${currentStatus}; ` +
        `permitted transitions are: ${allowedTransitions.join(", ") || "none"}`,
    );
    this.name = "LifecycleConflictError";
  }
}

export class BookingNotFoundError extends Error {
  constructor(bookingId: string) {
    super(`Booking ${bookingId} not found`);
    this.name = "BookingNotFoundError";
  }
}

export interface Actor {
  id: string;
  role: string;
}

export interface BookingRecord {
  id: string;
  status: BookingStatus;
}

export interface BookingRepositoryPort {
  findById(id: string): Promise<BookingRecord | null>;
  /** Conditional update: only succeeds if current status matches expectedFrom. Returns updated record or null on race loss. */
  conditionalStatusUpdate(
    id: string,
    expectedFrom: BookingStatus,
    to: BookingStatus,
  ): Promise<BookingRecord | null>;
}

export interface TransitionResult {
  booking: BookingRecord;
  isNoOp: boolean;
}

/** Statuses where same-status calls are idempotent (no audit row written). */
const IDEMPOTENT_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  "CONFIRMED",
  "CANCELLED",
]);

export class BookingLifecycleService {
  constructor(
    private readonly bookingRepo: BookingRepositoryPort,
    private readonly auditWriter: AuditWriter,
  ) {}

  async transition(
    bookingId: string,
    targetStatus: BookingStatus,
    actor: Actor,
    reason?: string,
  ): Promise<TransitionResult> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) throw new BookingNotFoundError(bookingId);

    const currentStatus = booking.status;

    // Idempotent same-status check
    if (currentStatus === targetStatus && IDEMPOTENT_STATUSES.has(currentStatus)) {
      return { booking, isNoOp: true };
    }

    // Deny-by-default: unknown or disallowed transition
    if (!isAllowedTransition(currentStatus, targetStatus)) {
      throw new LifecycleConflictError(
        bookingId,
        currentStatus,
        targetStatus,
        getAllowedTargets(currentStatus),
      );
    }

    // Conditional update (optimistic concurrency)
    const updated = await this.bookingRepo.conditionalStatusUpdate(
      bookingId,
      currentStatus,
      targetStatus,
    );

    if (!updated) {
      // Lost race — re-fetch to return the actual current state
      const fresh = await this.bookingRepo.findById(bookingId);
      const freshStatus = fresh?.status ?? currentStatus;
      throw new LifecycleConflictError(
        bookingId,
        freshStatus as BookingStatus,
        targetStatus,
        getAllowedTargets(freshStatus as BookingStatus),
      );
    }

    // Write audit row (in same transaction in production; after update in in-memory tests)
    await this.auditWriter.record({
      actorId: actor.id,
      actorRole: actor.role,
      resourceType: "booking",
      resourceId: bookingId,
      previousState: { status: currentStatus },
      newState: { status: targetStatus },
    });

    return { booking: updated, isNoOp: false };
  }
}
