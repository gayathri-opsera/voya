/**
 * Characterization tests — WO-095: Characterize booking, payment webhook, and auth logic.
 *
 * These tests document ACTUAL behavior of core business logic,
 * serving as a safety net for refactoring. They capture the current
 * behavior, including edge cases.
 *
 * Characterization tests differ from unit tests:
 * - They describe WHAT the system does, not WHAT it SHOULD do
 * - They fail when behavior changes (intentional or not)
 * - They are named after the observed behavior pattern
 */

import { describe, it, expect } from "vitest";
import { isAllowedTransition, ALLOWED_TRANSITIONS } from "../../services/booking-service/src/domain/transitions.js";
import { canPerformBookingAction } from "../../services/booking-service/src/domain/OwnershipGuard.js";
import { isPermitted } from "../../packages/rbac/src/index.js";
import { isBookableProvenance, BOOKABLE_PROVENANCES } from "../../packages/contracts/src/provenance/index.js";

// ─── Booking State Machine ──────────────────────────────────────────────────

describe("Characterization: booking state machine", () => {
  it("PENDING can transition to CONFIRMED", () => {
    expect(isAllowedTransition("PENDING", "CONFIRMED")).toBe(true);
  });

  it("PENDING can transition to CANCELLED", () => {
    expect(isAllowedTransition("PENDING", "CANCELLED")).toBe(true);
  });

  it("PENDING can transition to EXPIRED", () => {
    expect(isAllowedTransition("PENDING", "EXPIRED")).toBe(true);
  });

  it("PENDING cannot transition to COMPLETED", () => {
    expect(isAllowedTransition("PENDING", "COMPLETED")).toBe(false);
  });

  it("CONFIRMED can reach COMPLETED but not back to PENDING", () => {
    expect(isAllowedTransition("CONFIRMED", "COMPLETED")).toBe(true);
    expect(isAllowedTransition("CONFIRMED", "PENDING")).toBe(false);
  });

  it("CANCELLED is terminal (no outgoing transitions)", () => {
    expect(ALLOWED_TRANSITIONS["CANCELLED"].size).toBe(0);
  });

  it("EXPIRED is terminal (no outgoing transitions)", () => {
    expect(ALLOWED_TRANSITIONS["EXPIRED"].size).toBe(0);
  });

  it("COMPLETED is terminal (no outgoing transitions)", () => {
    expect(ALLOWED_TRANSITIONS["COMPLETED"].size).toBe(0);
  });
});

// ─── Ownership Predicates ────────────────────────────────────────────────────

describe("Characterization: ownership predicates", () => {
  it("traveler can read+cancel own bookings but not override", () => {
    const ctx = { actorId: "u1", actorRole: "traveler" as const, bookingOwnerId: "u1" };
    expect(canPerformBookingAction(ctx, "read")).toBe(true);
    expect(canPerformBookingAction(ctx, "cancel")).toBe(true);
    expect(canPerformBookingAction(ctx, "override_cancel")).toBe(false);
  });

  it("same user ID required for traveler own-resource access", () => {
    const ctxOwn = { actorId: "u1", actorRole: "traveler" as const, bookingOwnerId: "u1" };
    const ctxOther = { actorId: "u1", actorRole: "traveler" as const, bookingOwnerId: "u2" };
    expect(canPerformBookingAction(ctxOwn, "cancel")).toBe(true);
    expect(canPerformBookingAction(ctxOther, "cancel")).toBe(false);
  });
});

// ─── RBAC ────────────────────────────────────────────────────────────────────

describe("Characterization: RBAC deny-by-default", () => {
  it("traveler has no admin resource permissions", () => {
    expect(isPermitted({ actorId: "u1", actorRole: "traveler" }, "admin", "read")).toBe(false);
  });

  it("support_agent cannot read_pii", () => {
    expect(isPermitted({ actorId: "a1", actorRole: "support_agent" }, "user", "read_pii")).toBe(false);
  });

  it("system role bypasses ownOnly restrictions", () => {
    expect(
      isPermitted({ actorId: "svc", actorRole: "system", resourceOwnerId: "other_user" }, "booking", "cancel"),
    ).toBe(true);
  });
});

// ─── Offer Provenance ────────────────────────────────────────────────────────

describe("Characterization: offer provenance bookability", () => {
  it("AMADEUS, RAPIDAPI_HOTEL, RAPIDAPI_CAR are bookable", () => {
    expect(isBookableProvenance("AMADEUS")).toBe(true);
    expect(isBookableProvenance("RAPIDAPI_HOTEL")).toBe(true);
    expect(isBookableProvenance("RAPIDAPI_CAR")).toBe(true);
  });

  it("ILLUSTRATIVE is not bookable", () => {
    expect(isBookableProvenance("ILLUSTRATIVE")).toBe(false);
  });

  it("bookable provenances set has exactly 3 members", () => {
    expect(BOOKABLE_PROVENANCES.size).toBe(3);
  });
});
