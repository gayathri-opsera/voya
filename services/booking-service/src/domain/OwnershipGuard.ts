/**
 * OwnershipGuard — WO-044: role-based booking access control.
 *
 * Rules:
 * - A traveler may only read/modify their own bookings
 * - A support_agent may read any booking but not modify payment details
 * - An ops role may do everything including cancellation overrides
 * - Any other role is denied
 *
 * This is the ownership predicate that enforces BR-08.
 */

export type ActorRole = "traveler" | "support_agent" | "ops" | "system";

export type BookingAction =
  | "read"
  | "cancel"
  | "modify"
  | "read_payment"
  | "override_cancel"
  | "read_audit";

export interface OwnershipContext {
  actorId: string;
  actorRole: ActorRole;
  bookingOwnerId: string;
}

export class BookingAccessDeniedError extends Error {
  constructor(
    public readonly actorId: string,
    public readonly actorRole: ActorRole,
    public readonly action: BookingAction,
    public readonly bookingId: string,
  ) {
    super(
      `Actor ${actorId} (${actorRole}) is not permitted to ${action} booking ${bookingId}`,
    );
    this.name = "BookingAccessDeniedError";
  }
}

/** Returns true iff the actor may perform the action on the booking. */
export function canPerformBookingAction(
  ctx: OwnershipContext,
  action: BookingAction,
): boolean {
  const { actorRole, actorId, bookingOwnerId } = ctx;

  switch (actorRole) {
    case "ops":
    case "system":
      return true;

    case "support_agent":
      // Can read everything; cannot modify payment or override cancel
      return action === "read" || action === "read_audit" || action === "cancel";

    case "traveler":
      // Must own the booking
      if (actorId !== bookingOwnerId) return false;
      return (
        action === "read" ||
        action === "cancel" ||
        action === "modify" ||
        action === "read_audit"
      );

    default:
      return false;
  }
}

/** Throws BookingAccessDeniedError if the action is not permitted. */
export function assertBookingAccess(
  ctx: OwnershipContext,
  action: BookingAction,
  bookingId: string,
): void {
  if (!canPerformBookingAction(ctx, action)) {
    throw new BookingAccessDeniedError(ctx.actorId, ctx.actorRole, action, bookingId);
  }
}
