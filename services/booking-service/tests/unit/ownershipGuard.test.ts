import { describe, it, expect } from "vitest";
import {
  canPerformBookingAction,
  assertBookingAccess,
  BookingAccessDeniedError,
  type OwnershipContext,
} from "../../src/domain/OwnershipGuard.js";

const traveler: OwnershipContext = { actorId: "u1", actorRole: "traveler", bookingOwnerId: "u1" };
const otherTraveler: OwnershipContext = { actorId: "u2", actorRole: "traveler", bookingOwnerId: "u1" };
const agent: OwnershipContext = { actorId: "agent1", actorRole: "support_agent", bookingOwnerId: "u1" };
const ops: OwnershipContext = { actorId: "ops1", actorRole: "ops", bookingOwnerId: "u1" };

describe("canPerformBookingAction", () => {
  it("traveler can read own booking", () => {
    expect(canPerformBookingAction(traveler, "read")).toBe(true);
  });

  it("traveler cannot read another user's booking", () => {
    expect(canPerformBookingAction(otherTraveler, "read")).toBe(false);
  });

  it("traveler can cancel own booking", () => {
    expect(canPerformBookingAction(traveler, "cancel")).toBe(true);
  });

  it("support_agent can read any booking", () => {
    expect(canPerformBookingAction(agent, "read")).toBe(true);
  });

  it("support_agent cannot read payment details", () => {
    expect(canPerformBookingAction(agent, "read_payment")).toBe(false);
  });

  it("support_agent cannot override cancel", () => {
    expect(canPerformBookingAction(agent, "override_cancel")).toBe(false);
  });

  it("ops can do everything", () => {
    const actions = ["read", "cancel", "modify", "read_payment", "override_cancel", "read_audit"] as const;
    for (const action of actions) {
      expect(canPerformBookingAction(ops, action)).toBe(true);
    }
  });
});

describe("assertBookingAccess", () => {
  it("throws BookingAccessDeniedError when denied", () => {
    expect(() =>
      assertBookingAccess(otherTraveler, "read", "booking_123"),
    ).toThrow(BookingAccessDeniedError);
  });

  it("does not throw when allowed", () => {
    expect(() => assertBookingAccess(traveler, "read", "booking_123")).not.toThrow();
  });

  it("error includes actor and booking info", () => {
    try {
      assertBookingAccess(otherTraveler, "cancel", "booking_456");
    } catch (err) {
      expect(err).toBeInstanceOf(BookingAccessDeniedError);
      const e = err as BookingAccessDeniedError;
      expect(e.actorId).toBe("u2");
      expect(e.action).toBe("cancel");
      expect(e.bookingId).toBe("booking_456");
    }
  });
});
