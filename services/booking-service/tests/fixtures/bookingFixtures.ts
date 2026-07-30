import type { BookingRecord } from "../../src/domain/BookingLifecycleService.js";
import type { BookingStatus } from "../../src/domain/transitions.js";

export function makeBooking(
  id: string,
  status: BookingStatus,
): BookingRecord {
  return { id, status };
}

export const PENDING_BOOKING   = makeBooking("book_pending",   "PENDING");
export const CONFIRMED_BOOKING = makeBooking("book_confirmed", "CONFIRMED");
export const CANCELLED_BOOKING = makeBooking("book_cancelled", "CANCELLED");
export const EXPIRED_BOOKING   = makeBooking("book_expired",   "EXPIRED");
export const COMPLETED_BOOKING = makeBooking("book_completed", "COMPLETED");
