/**
 * @voya/contracts — Standard API error envelope
 *
 * All Voya REST services must respond with this shape for 4xx and 5xx errors.
 * The schema is intentionally strict (.strict()) so that internal fields such
 * as stack traces, raw secrets, or undeclared implementation details cannot
 * accidentally escape the service boundary.
 *
 * Applicable HTTP status codes: 400, 401, 403, 404, 409, 422, 429, 502, 503.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// ApiErrorDetail
// Represents one field-level or rule-level violation within an error response.
// ---------------------------------------------------------------------------

export const ApiErrorDetailSchema = z
  .object({
    /**
     * JSON Pointer (RFC 6901) to the offending request field, e.g. "/body/dates/checkIn".
     * Omit for rule-level violations that are not tied to a single field.
     */
    field: z.string().optional(),

    /**
     * Machine-readable rule identifier, e.g. "min_stay_nights_violated".
     * Omit for raw field-constraint violations where `field` is sufficient.
     */
    rule: z.string().optional(),

    /**
     * Safe, human-readable description of this specific violation.
     * Must NOT contain stack traces, internal identifiers, or PII.
     */
    message: z.string().min(1, 'detail message must not be empty'),
  })
  .strict();

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

// ---------------------------------------------------------------------------
// ApiError
// Top-level error envelope. Using .strict() means any undeclared field
// (e.g. `stack`, `stackTrace`, `password`, `token`, `secret`) causes a
// ZodError at validation time, preventing internal details from leaking.
// ---------------------------------------------------------------------------

export const ApiErrorSchema = z
  .object({
    /**
     * Stable machine-readable error code scoped to the originating service,
     * e.g. "RECEIPT_STALE", "SUPPLIER_UNCERTIFIED", "INVALID_DATE_RANGE".
     * Must remain stable across patch releases; changing it is a breaking change.
     */
    code: z.string().min(1, 'error code must not be empty'),

    /**
     * Safe, human-readable error message suitable for display in a support
     * context. Must NOT reveal stack traces, raw SQL, internal paths, secrets,
     * payment details, Bonvoy identifiers, or traveller PII.
     */
    message: z.string().min(1, 'error message must not be empty'),

    /**
     * W3C trace context–compatible correlation identifier for this request.
     * Required on every error response so that support can correlate client
     * reports with distributed traces without sharing internal log data.
     */
    correlationId: z.string().min(1, 'correlationId must not be empty'),

    /**
     * Optional array of field-level or rule-level detail objects.
     * Present for 400, 422 validation errors; may be omitted for 401, 403,
     * 404, 429, 502, 503 where per-field context is not applicable.
     */
    details: z.array(ApiErrorDetailSchema).optional(),
  })
  .strict();

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------------------------------------------------------------------------
// Helper: safe parse wrapper that returns a typed result union instead of
// throwing, keeping validation failures as data rather than exceptions.
// ---------------------------------------------------------------------------

export type ApiErrorParseResult =
  | { success: true; data: ApiError }
  | { success: false; error: z.ZodError };

/**
 * Validates an unknown payload against ApiErrorSchema without throwing.
 *
 * @example
 * const result = parseApiError(responseBody);
 * if (!result.success) {
 *   logger.warn('Invalid error envelope', result.error.issues);
 * }
 */
export function parseApiError(input: unknown): ApiErrorParseResult {
  const result = ApiErrorSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
