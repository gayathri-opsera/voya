/**
 * Booking lifecycle state machine.
 *
 * Permitted transition matrix (BR-04, WO-040):
 *   PENDING → CONFIRMED | CANCELLED | EXPIRED
 *   CONFIRMED → COMPLETED | CANCELLED
 *   (all other pairs are refused)
 *
 * Same-status calls for CONFIRMED and CANCELLED are idempotent (no-op).
 */

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED"
  | "COMPLETED";

/** The single exported authority for all allowed transitions. */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<BookingStatus, ReadonlySet<BookingStatus>>
> = {
  PENDING:   new Set<BookingStatus>(["CONFIRMED", "CANCELLED", "EXPIRED"]),
  CONFIRMED: new Set<BookingStatus>(["COMPLETED", "CANCELLED"]),
  CANCELLED: new Set<BookingStatus>(),
  EXPIRED:   new Set<BookingStatus>(),
  COMPLETED: new Set<BookingStatus>(),
} as const;

/** Returns true iff the transition is permitted. */
export function isAllowedTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  const targets = ALLOWED_TRANSITIONS[from];
  return targets !== undefined && targets.has(to);
}

/** Returns the allowed targets from the given status as an array. */
export function getAllowedTargets(from: BookingStatus): BookingStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}
