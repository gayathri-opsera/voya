import { describe, it, expect } from "vitest";
import { ZodError, z } from "zod";
import {
  ErrorEnvelopeSchema,
  ErrorCode,
  HTTP_STATUS_MAP,
  resolveHttpStatus,
  serialiseError,
  AppError,
  validationFailed,
  forbidden,
  notFound,
  lifecycleConflict,
  supplierRejected,
  rateLimited,
  supplierUnavailable,
  supplierTimeout,
  RESTRICTED_FIELDS,
} from "../../../src/errors/index.js";
import {
  envelope400,
  envelope401,
  envelope403,
  envelope404,
  envelope409,
  envelope422,
  envelope429,
  envelope500,
  envelope502,
  envelope504,
} from "../../fixtures/errors.js";

const TRACE_ID = "corr_01J9X0Y2Z3A4B5C6D7E8F9G0";

// ─── Envelope schema ──────────────────────────────────────────────────────────

describe("ErrorEnvelopeSchema", () => {
  it("parses a valid 400 envelope", () => {
    const result = ErrorEnvelopeSchema.safeParse(envelope400);
    expect(result.success).toBe(true);
  });

  it("parses an envelope without the optional field key", () => {
    const result = ErrorEnvelopeSchema.safeParse(envelope401);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.error.field).toBeUndefined();
    }
  });

  it("rejects an extra top-level key (strict shape)", () => {
    const result = ErrorEnvelopeSchema.safeParse({
      ...envelope400,
      extraKey: "should-not-be-here",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an extra key inside the error object (strict shape)", () => {
    const result = ErrorEnvelopeSchema.safeParse({
      error: { ...envelope400.error, unexpectedKey: "bad" },
      reference: TRACE_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty reference string", () => {
    const result = ErrorEnvelopeSchema.safeParse({ ...envelope400, reference: "" });
    expect(result.success).toBe(false);
  });
});

// ─── HTTP status mapping completeness ────────────────────────────────────────

describe("HTTP_STATUS_MAP completeness", () => {
  const allowedStatuses = new Set([400, 401, 403, 404, 409, 422, 429, 500, 502, 504]);
  const allCodes = Object.values(ErrorCode);

  it("every ErrorCode maps to exactly one HTTP status", () => {
    allCodes.forEach((code) => {
      const status = HTTP_STATUS_MAP[code];
      expect(status, `${code} is unmapped`).toBeDefined();
      expect(allowedStatuses.has(status), `${code} maps to disallowed status ${status}`).toBe(true);
    });
  });

  it("resolveHttpStatus returns the expected status for each code", () => {
    expect(resolveHttpStatus(ErrorCode.VALIDATION_FAILED)).toBe(400);
    expect(resolveHttpStatus(ErrorCode.UNAUTHENTICATED)).toBe(401);
    expect(resolveHttpStatus(ErrorCode.FORBIDDEN)).toBe(403);
    expect(resolveHttpStatus(ErrorCode.NOT_FOUND)).toBe(404);
    expect(resolveHttpStatus(ErrorCode.CONFLICT)).toBe(409);
    expect(resolveHttpStatus(ErrorCode.LIFECYCLE_CONFLICT)).toBe(409);
    expect(resolveHttpStatus(ErrorCode.DUPLICATE_EMAIL)).toBe(409);
    expect(resolveHttpStatus(ErrorCode.SUPPLIER_REJECTED)).toBe(422);
    expect(resolveHttpStatus(ErrorCode.RATE_LIMITED)).toBe(429);
    expect(resolveHttpStatus(ErrorCode.INTERNAL_ERROR)).toBe(500);
    expect(resolveHttpStatus(ErrorCode.SUPPLIER_UNAVAILABLE)).toBe(502);
    expect(resolveHttpStatus(ErrorCode.SUPPLIER_TIMEOUT)).toBe(504);
  });
});

// ─── serialiseError — Zod failures ───────────────────────────────────────────

describe("serialiseError — Zod validation failure", () => {
  it("produces a 400 VALIDATION_FAILED envelope with the field path", () => {
    const schema = z.object({ origin: z.string().regex(/^[A-Z]{3}$/, "Airport code must be a 3-letter IATA code (e.g. JFK, LHR, SYD)") });
    let zodError: ZodError | null = null;
    try {
      schema.parse({ origin: "JFKK" });
    } catch (err) {
      if (err instanceof ZodError) zodError = err;
    }
    expect(zodError).not.toBeNull();

    const { envelope, status } = serialiseError(zodError!, TRACE_ID);
    expect(status).toBe(400);
    expect(envelope.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(envelope.error.field).toBe("origin");
    expect(envelope.error.message).toMatch(/3-letter IATA code/i);
    expect(envelope.reference).toBe(TRACE_ID);
  });

  it("produces an envelope with no field key when the path is empty (whole-body refinement)", () => {
    const schema = z.object({}).superRefine((_data, ctx) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Whole-body failure", path: [] });
    });
    let zodError: ZodError | null = null;
    try {
      schema.parse({});
    } catch (err) {
      if (err instanceof ZodError) zodError = err;
    }
    const { envelope } = serialiseError(zodError!, TRACE_ID);
    expect(envelope.error.field).toBeUndefined();
  });

  it("serialises nested array field paths as dotted strings", () => {
    const schema = z.object({
      passengers: z.array(z.object({ passportNumber: z.string().regex(/^[A-Z0-9]{6,20}$/) })),
    });
    let zodError: ZodError | null = null;
    try {
      schema.parse({ passengers: [{ passportNumber: "X" }] });
    } catch (err) {
      if (err instanceof ZodError) zodError = err;
    }
    const { envelope } = serialiseError(zodError!, TRACE_ID);
    expect(envelope.error.field).toBe("passengers.0.passportNumber");
  });
});

// ─── serialiseError — AppError ────────────────────────────────────────────────

describe("serialiseError — AppError (domain errors)", () => {
  it("serialises a forbidden error with 403 status", () => {
    const { envelope, status } = serialiseError(forbidden(), TRACE_ID);
    expect(status).toBe(403);
    expect(envelope.error.code).toBe(ErrorCode.FORBIDDEN);
    expect(envelope.reference).toBe(TRACE_ID);
  });

  it("serialises a lifecycle conflict with 409 status", () => {
    const { envelope, status } = serialiseError(
      lifecycleConflict("PENDING", ["CONFIRMED", "CANCELLED"]),
      TRACE_ID,
    );
    expect(status).toBe(409);
    expect(envelope.error.code).toBe(ErrorCode.LIFECYCLE_CONFLICT);
    expect(envelope.error.message).toMatch(/PENDING/);
  });

  it("serialises a supplier timeout with 504 status", () => {
    const { envelope, status } = serialiseError(supplierTimeout("Amadeus"), TRACE_ID);
    expect(status).toBe(504);
    expect(envelope.error.code).toBe(ErrorCode.SUPPLIER_TIMEOUT);
  });

  it("includes the field in the envelope when AppError carries one", () => {
    const { envelope } = serialiseError(validationFailed("Invalid code", "origin"), TRACE_ID);
    expect(envelope.error.field).toBe("origin");
  });
});

// ─── serialiseError — leakage prevention ─────────────────────────────────────

describe("serialiseError — A10 leakage prevention", () => {
  it("never includes a stack trace in the envelope for unknown errors", () => {
    const err = new Error("Database error: SELECT * FROM users WHERE id = 1");
    const { envelope, status } = serialiseError(err, TRACE_ID);
    const body = JSON.stringify(envelope);

    expect(status).toBe(500);
    expect(envelope.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body).not.toContain("SELECT");
    expect(body).not.toContain("Database error");
    expect(body).not.toContain("stack");
  });

  it("never includes a fake secret token in the envelope", () => {
    const secretToken = "sk_live_secret_ABCDEFGHIJKLMNOP_should_never_appear";
    const err = new Error(`Stripe error: token ${secretToken} rejected`);
    err.stack = `Error: Stripe error: token ${secretToken}\n    at handler (service.ts:42)`;
    const { envelope } = serialiseError(err, TRACE_ID);
    const body = JSON.stringify(envelope);

    expect(body).not.toContain(secretToken);
    expect(body).not.toContain("sk_live");
    expect(body).not.toContain("service.ts");
  });

  it("never includes a filesystem path in the envelope", () => {
    const err = new Error("ENOENT: no such file or directory, open '/etc/passwd'");
    const { envelope } = serialiseError(err, TRACE_ID);
    const body = JSON.stringify(envelope);
    expect(body).not.toContain("/etc/passwd");
  });

  it("handles a non-Error thrown value (string) without crashing", () => {
    const { envelope, status } = serialiseError("bare string error", TRACE_ID);
    expect(status).toBe(500);
    expect(envelope.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("handles undefined thrown value without crashing", () => {
    const { envelope, status } = serialiseError(undefined, TRACE_ID);
    expect(status).toBe(500);
    expect(envelope.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("handles a number thrown value without crashing", () => {
    const { envelope } = serialiseError(404, TRACE_ID);
    expect(envelope.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });
});

// ─── Restricted field redaction ───────────────────────────────────────────────

describe("Restricted-tier field redaction", () => {
  const restrictedFields = [
    "passportNumber",
    "dateOfBirth",
    "email",
    "passwordHash",
    "authorization",
    "stripe-signature",
  ];

  restrictedFields.forEach((fieldName) => {
    it(`does not echo the value for Restricted field: ${fieldName}`, () => {
      const rejectedValue = `SENSITIVE_VALUE_FOR_${fieldName}_SHOULD_NOT_APPEAR`;
      const schema = z.object({ [fieldName]: z.literal("safe") });
      let zodError: ZodError | null = null;
      try {
        schema.parse({ [fieldName]: rejectedValue });
      } catch (err) {
        if (err instanceof ZodError) zodError = err;
      }
      const { envelope } = serialiseError(zodError!, TRACE_ID);
      const body = JSON.stringify(envelope);
      expect(body).not.toContain(rejectedValue);
      expect(envelope.error.field).toBe(fieldName);
    });
  });
});

// ─── Reference fallback ───────────────────────────────────────────────────────

describe("serialiseError — reference fallback", () => {
  it("uses the supplied traceId as the reference", () => {
    const { envelope } = serialiseError(new AppError("NOT_FOUND", "Not found"), TRACE_ID);
    expect(envelope.reference).toBe(TRACE_ID);
  });

  it("generates a non-empty reference when no traceId is supplied", () => {
    const { envelope } = serialiseError(new AppError("NOT_FOUND", "Not found"));
    expect(envelope.reference).toBeTruthy();
    expect(envelope.reference.length).toBeGreaterThan(0);
  });

  it("generates a non-empty reference when traceId is an empty string", () => {
    const { envelope } = serialiseError(new AppError("NOT_FOUND", "Not found"), "");
    expect(envelope.reference).toBeTruthy();
    expect(envelope.reference.length).toBeGreaterThan(0);
  });
});

// ─── Error fixtures validity ──────────────────────────────────────────────────

describe("Error fixture envelopes parse correctly", () => {
  const fixtures = [
    { name: "400", envelope: envelope400 },
    { name: "401", envelope: envelope401 },
    { name: "403", envelope: envelope403 },
    { name: "404", envelope: envelope404 },
    { name: "409", envelope: envelope409 },
    { name: "422", envelope: envelope422 },
    { name: "429", envelope: envelope429 },
    { name: "500", envelope: envelope500 },
    { name: "502", envelope: envelope502 },
    { name: "504", envelope: envelope504 },
  ];

  fixtures.forEach(({ name, envelope }) => {
    it(`fixture for HTTP ${name} is a valid ErrorEnvelope`, () => {
      const result = ErrorEnvelopeSchema.safeParse(envelope);
      expect(result.success).toBe(true);
    });
  });
});
