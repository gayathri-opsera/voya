import { describe, it, expect } from "vitest";
import { mapEnvelopeToFormErrors, hasFieldError } from "../../lib/errors";
import type { ErrorEnvelope } from "@travel/contracts";

describe("mapEnvelopeToFormErrors", () => {
  const knownFields = new Set(["origin", "destination", "departureDate", "passengers"]);

  it("attaches the error message to a matching form field", () => {
    const envelope: ErrorEnvelope = {
      error: {
        code: "VALIDATION_FAILED",
        message: "Airport code must be a 3-letter IATA code (e.g. JFK, LHR, SYD)",
        field: "origin",
      },
      reference: "ref-abc",
    };
    const result = mapEnvelopeToFormErrors(envelope, knownFields);
    expect(result.fieldErrors["origin"]).toBe(
      "Airport code must be a 3-letter IATA code (e.g. JFK, LHR, SYD)",
    );
    expect(result.formError).toBeUndefined();
    expect(result.reference).toBe("ref-abc");
  });

  it("falls back to form-level banner when field is not a known form field", () => {
    const envelope: ErrorEnvelope = {
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission",
      },
      reference: "ref-xyz",
    };
    const result = mapEnvelopeToFormErrors(envelope, knownFields);
    expect(result.formError).toBe("You do not have permission");
    expect(Object.keys(result.fieldErrors)).toHaveLength(0);
  });

  it("falls back when error.field is present but not in knownFields", () => {
    const envelope: ErrorEnvelope = {
      error: {
        code: "VALIDATION_FAILED",
        message: "Nested error",
        field: "passengers.0.passportNumber",
      },
      reference: "ref-123",
    };
    const result = mapEnvelopeToFormErrors(envelope, knownFields);
    expect(result.formError).toBe("Nested error");
    expect(Object.keys(result.fieldErrors)).toHaveLength(0);
  });

  it("always surfaces the reference identifier", () => {
    const envelope: ErrorEnvelope = {
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      reference: "ref-support-123",
    };
    const result = mapEnvelopeToFormErrors(envelope, knownFields);
    expect(result.reference).toBe("ref-support-123");
  });
});

describe("hasFieldError", () => {
  const envelope: ErrorEnvelope = {
    error: { code: "VALIDATION_FAILED", message: "Error", field: "origin" },
    reference: "ref-1",
  };
  it("returns true when envelope matches the field", () => {
    expect(hasFieldError(envelope, "origin")).toBe(true);
  });
  it("returns false for a different field", () => {
    expect(hasFieldError(envelope, "destination")).toBe(false);
  });
  it("returns false for null envelope", () => {
    expect(hasFieldError(null, "origin")).toBe(false);
  });
});
