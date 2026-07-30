import { describe, it, expect } from "vitest";
import { sanitiseAuditPayload } from "@travel/contracts/audit";

describe("sanitiseAuditPayload", () => {
  it("returns primitive values unchanged", () => {
    expect(sanitiseAuditPayload("hello")).toBe("hello");
    expect(sanitiseAuditPayload(42)).toBe(42);
    expect(sanitiseAuditPayload(null)).toBeNull();
  });

  it("redacts top-level sensitive keys", () => {
    const result = sanitiseAuditPayload({
      email: "user@example.com",
      name: "Alice",
      passwordHash: "argon2id$...",
    }) as Record<string, unknown>;
    expect(result.email).toBe("[REDACTED]");
    expect(result.passwordHash).toBe("[REDACTED]");
    expect(result.name).toBe("Alice");
  });

  it("redacts nested sensitive keys", () => {
    const result = sanitiseAuditPayload({
      traveler: {
        name: "Bob",
        passportNumber: "AB1234",
        dateOfBirth: "1990-01-01",
      },
    }) as Record<string, Record<string, unknown>>;
    expect(result.traveler!.passportNumber).toBe("[REDACTED]");
    expect(result.traveler!.dateOfBirth).toBe("[REDACTED]");
    expect(result.traveler!.name).toBe("Bob");
  });

  it("redacts sensitive keys in arrays", () => {
    const result = sanitiseAuditPayload([
      { email: "a@b.com", status: "PENDING" },
      { email: "c@d.com", status: "CONFIRMED" },
    ]) as Array<Record<string, unknown>>;
    expect(result[0]!.email).toBe("[REDACTED]");
    expect(result[0]!.status).toBe("PENDING");
  });

  it("redacts authorization and stripe-signature keys", () => {
    const result = sanitiseAuditPayload({
      authorization: "Bearer token123",
      "stripe-signature": "t=123,v1=abc",
      bookingId: "b1",
    }) as Record<string, unknown>;
    expect(result.authorization).toBe("[REDACTED]");
    expect(result["stripe-signature"]).toBe("[REDACTED]");
    expect(result.bookingId).toBe("b1");
  });

  it("does not modify the original input", () => {
    const original = { email: "user@example.com", name: "Alice" };
    sanitiseAuditPayload(original);
    expect(original.email).toBe("user@example.com");
  });
});
