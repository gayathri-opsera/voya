import { describe, it, expect } from "vitest";
import { validateProvenance, isBookableProvenance, ProvenanceSchema } from "@travel/contracts/provenance";

describe("ProvenanceSchema", () => {
  it("accepts valid supplier values", () => {
    expect(ProvenanceSchema.safeParse("AMADEUS").success).toBe(true);
    expect(ProvenanceSchema.safeParse("RAPIDAPI_HOTEL").success).toBe(true);
    expect(ProvenanceSchema.safeParse("RAPIDAPI_CAR").success).toBe(true);
    expect(ProvenanceSchema.safeParse("ILLUSTRATIVE").success).toBe(true);
  });

  it("rejects unknown provenance strings", () => {
    expect(ProvenanceSchema.safeParse("UNKNOWN_PARTNER").success).toBe(false);
    expect(ProvenanceSchema.safeParse("").success).toBe(false);
    expect(ProvenanceSchema.safeParse(null).success).toBe(false);
  });
});

describe("isBookableProvenance", () => {
  it("returns true for certified suppliers", () => {
    expect(isBookableProvenance("AMADEUS")).toBe(true);
    expect(isBookableProvenance("RAPIDAPI_HOTEL")).toBe(true);
    expect(isBookableProvenance("RAPIDAPI_CAR")).toBe(true);
  });

  it("returns false for ILLUSTRATIVE", () => {
    expect(isBookableProvenance("ILLUSTRATIVE")).toBe(false);
  });

  it("returns false for unknown strings", () => {
    expect(isBookableProvenance("FABRICATED")).toBe(false);
  });
});

describe("validateProvenance", () => {
  it("returns valid for bookable provenance", () => {
    expect(validateProvenance("AMADEUS")).toEqual({ valid: true });
  });

  it("returns invalid for ILLUSTRATIVE", () => {
    const r = validateProvenance("ILLUSTRATIVE");
    expect(r.valid).toBe(false);
    expect((r as { valid: false; reason: string }).reason).toContain("not bookable");
  });

  it("returns invalid for unknown value", () => {
    const r = validateProvenance("AI_FABRICATED");
    expect(r.valid).toBe(false);
    expect((r as { valid: false; reason: string }).reason).toContain("Unknown");
  });
});
