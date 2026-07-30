import { describe, it, expect, beforeEach } from "vitest";
import {
  isAllowedTransition,
  getAllowedTargets,
  ALLOWED_TRANSITIONS,
  type BookingStatus,
} from "../../src/domain/transitions.js";

const ALL_STATUSES: BookingStatus[] = [
  "PENDING", "CONFIRMED", "CANCELLED", "EXPIRED", "COMPLETED",
];

describe("ALLOWED_TRANSITIONS matrix", () => {
  it("PENDING → CONFIRMED is allowed", () => {
    expect(isAllowedTransition("PENDING", "CONFIRMED")).toBe(true);
  });
  it("PENDING → CANCELLED is allowed", () => {
    expect(isAllowedTransition("PENDING", "CANCELLED")).toBe(true);
  });
  it("PENDING → EXPIRED is allowed", () => {
    expect(isAllowedTransition("PENDING", "EXPIRED")).toBe(true);
  });
  it("CONFIRMED → COMPLETED is allowed", () => {
    expect(isAllowedTransition("CONFIRMED", "COMPLETED")).toBe(true);
  });
  it("CONFIRMED → CANCELLED is allowed", () => {
    expect(isAllowedTransition("CONFIRMED", "CANCELLED")).toBe(true);
  });

  it("PENDING → COMPLETED is refused", () => {
    expect(isAllowedTransition("PENDING", "COMPLETED")).toBe(false);
  });
  it("CONFIRMED → PENDING is refused", () => {
    expect(isAllowedTransition("CONFIRMED", "PENDING")).toBe(false);
  });
  it("CONFIRMED → EXPIRED is refused", () => {
    expect(isAllowedTransition("CONFIRMED", "EXPIRED")).toBe(false);
  });
  it("CANCELLED → any is refused", () => {
    for (const to of ALL_STATUSES) {
      expect(isAllowedTransition("CANCELLED", to)).toBe(false);
    }
  });
  it("EXPIRED → any is refused", () => {
    for (const to of ALL_STATUSES) {
      expect(isAllowedTransition("EXPIRED", to)).toBe(false);
    }
  });
  it("COMPLETED → any is refused", () => {
    for (const to of ALL_STATUSES) {
      expect(isAllowedTransition("COMPLETED", to)).toBe(false);
    }
  });

  it("covers every status in the matrix (no missing entries)", () => {
    for (const status of ALL_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
    }
  });
});

describe("getAllowedTargets", () => {
  it("returns targets for PENDING", () => {
    const targets = getAllowedTargets("PENDING");
    expect(targets).toContain("CONFIRMED");
    expect(targets).toContain("CANCELLED");
    expect(targets).toContain("EXPIRED");
  });

  it("returns empty array for terminal states", () => {
    expect(getAllowedTargets("CANCELLED")).toHaveLength(0);
    expect(getAllowedTargets("EXPIRED")).toHaveLength(0);
    expect(getAllowedTargets("COMPLETED")).toHaveLength(0);
  });
});
