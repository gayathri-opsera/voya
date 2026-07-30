import { ZodError, ZodIssue } from "zod";
import { ErrorCode, resolveHttpStatus, type AllowedHttpStatus } from "./codes.js";
import { type ErrorEnvelope } from "./envelope.js";
import { AppError } from "./domain-errors.js";

/**
 * Restricted-tier field names whose rejected VALUES must never appear in
 * any response body. Only the field NAME may be included.
 * This list mirrors the Pino logger redaction paths — they must stay in sync.
 */
export const RESTRICTED_FIELDS = new Set([
  "passportNumber",
  "dateOfBirth",
  "email",
  "passwordHash",
  "password",
  "authorization",
  "stripe-signature",
  "x-api-key",
  "apiKey",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "clientSecret",
]);

/** Returns true when a field name (last segment of path) is Restricted-tier. */
function isRestrictedField(fieldPath: string): boolean {
  const lastSegment = fieldPath.split(".").at(-1) ?? fieldPath;
  return RESTRICTED_FIELDS.has(lastSegment);
}

/**
 * Converts a Zod issue path array to a dotted-string path.
 * e.g. ["passengers", 2, "passportNumber"] → "passengers.2.passportNumber"
 */
function pathToString(path: ZodIssue["path"]): string {
  return path.join(".");
}

/**
 * Formats an actionable validation message from a single Zod issue.
 * If the field is Restricted-tier, the message names the field but never
 * echoes the rejected value.
 */
function formatValidationMessage(issue: ZodIssue): string {
  const field = pathToString(issue.path);
  if (field && isRestrictedField(field)) {
    return `Validation failed for field: ${field}`;
  }
  return issue.message;
}

/**
 * Generates a fallback correlation identifier when no trace context is
 * available. Uses crypto.randomUUID when available, otherwise a timestamp
 * prefix for sortability.
 */
function generateFallbackReference(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface SerialiseResult {
  envelope: ErrorEnvelope;
  status: AllowedHttpStatus;
}

/**
 * Converts any thrown value into a standardised error envelope.
 *
 * - ZodError → VALIDATION_FAILED with the first issue's field path and message
 * - AppError → uses the code, message, and optional field from the error
 * - Anything else → INTERNAL_ERROR with a fixed generic message (A10 leakage prevention)
 *
 * @param error   The value caught by catch or error handler
 * @param traceId Active trace/correlation ID (X-Ray format). When absent,
 *                a local identifier is generated so reference is never empty.
 */
export function serialiseError(
  error: unknown,
  traceId?: string,
): SerialiseResult {
  const reference = traceId !== undefined && traceId.length > 0
    ? traceId
    : generateFallbackReference();

  // ── Zod validation failure ──────────────────────────────────────────────
  if (error instanceof ZodError) {
    const issues = error.issues;
    // Pick the first issue in path order for a deterministic single-field response
    const primary = issues[0];
    const field = primary !== undefined ? pathToString(primary.path) : undefined;
    const message = primary !== undefined
      ? formatValidationMessage(primary)
      : "Validation failed";

    return {
      envelope: {
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message,
          ...(field !== undefined && field.length > 0 ? { field } : {}),
        },
        reference,
      },
      status: 400,
    };
  }

  // ── Typed domain error ───────────────────────────────────────────────────
  if (error instanceof AppError) {
    const status = resolveHttpStatus(error.code);
    return {
      envelope: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.field !== undefined ? { field: error.field } : {}),
        },
        reference,
      },
      status,
    };
  }

  // ── Unknown error — A10 leakage prevention ────────────────────────────────
  // Never emit the original message, stack, class name, or any internal detail.
  return {
    envelope: {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred. Please try again or contact support.",
      },
      reference,
    },
    status: 500,
  };
}
