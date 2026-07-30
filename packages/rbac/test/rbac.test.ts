import { describe, it, expect } from "vitest";
import {
  isPermitted,
  assertPermitted,
  AccessDeniedError,
  ROLE_PERMISSIONS,
  type RbacRole,
} from "../src/index.ts";

describe("RBAC — deny-by-default", () => {
  it("traveler can read own booking", () => {
    expect(
      isPermitted({ actorId: "u1", actorRole: "traveler", resourceOwnerId: "u1" }, "booking", "read"),
    ).toBe(true);
  });

  it("traveler cannot read another user booking (ownOnly)", () => {
    expect(
      isPermitted({ actorId: "u1", actorRole: "traveler", resourceOwnerId: "u2" }, "booking", "read"),
    ).toBe(false);
  });

  it("traveler cannot override a booking", () => {
    expect(
      isPermitted({ actorId: "u1", actorRole: "traveler", resourceOwnerId: "u1" }, "booking", "override"),
    ).toBe(false);
  });

  it("support_agent can read any booking", () => {
    expect(
      isPermitted({ actorId: "agent1", actorRole: "support_agent", resourceOwnerId: "u99" }, "booking", "read"),
    ).toBe(true);
  });

  it("support_agent cannot read PII", () => {
    expect(
      isPermitted({ actorId: "agent1", actorRole: "support_agent" }, "user", "read_pii"),
    ).toBe(false);
  });

  it("ops can read PII", () => {
    expect(isPermitted({ actorId: "ops1", actorRole: "ops" }, "user", "read_pii")).toBe(true);
  });

  it("system has create booking permission", () => {
    expect(isPermitted({ actorId: "svc", actorRole: "system" }, "booking", "create")).toBe(true);
  });

  it("unknown role is denied (deny-by-default)", () => {
    expect(
      isPermitted({ actorId: "x", actorRole: "unknown" as RbacRole }, "booking", "read"),
    ).toBe(false);
  });

  it("assertPermitted throws AccessDeniedError when denied", () => {
    expect(() =>
      assertPermitted(
        { actorId: "u1", actorRole: "traveler", resourceOwnerId: "u2" },
        "booking",
        "cancel",
      ),
    ).toThrow(AccessDeniedError);
  });

  it("assertPermitted does not throw when allowed", () => {
    expect(() =>
      assertPermitted(
        { actorId: "u1", actorRole: "traveler", resourceOwnerId: "u1" },
        "booking",
        "cancel",
      ),
    ).not.toThrow();
  });

  it("every role definition has at least one permission", () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as RbacRole[];
    for (const role of roles) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });
});
