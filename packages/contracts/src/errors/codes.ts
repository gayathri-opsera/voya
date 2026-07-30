/**
 * Canonical error codes for all platform failures.
 * Every code maps to exactly one HTTP status — the mapping table is typed
 * as an exhaustive Record so a missing entry is a TypeScript compile error.
 */

export const ErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  LIFECYCLE_CONFLICT: "LIFECYCLE_CONFLICT",
  DUPLICATE_EMAIL: "DUPLICATE_EMAIL",
  SUPPLIER_REJECTED: "SUPPLIER_REJECTED",
  RATE_LIMITED: "RATE_LIMITED",
  SUPPLIER_UNAVAILABLE: "SUPPLIER_UNAVAILABLE",
  SUPPLIER_TIMEOUT: "SUPPLIER_TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Allowed HTTP status codes per the platform API contract.
 * This set is exhaustive — no other statuses may be returned for error cases.
 */
export type AllowedHttpStatus =
  | 400  // Malformed request or validation failure
  | 401  // Unauthenticated
  | 403  // Authenticated but forbidden
  | 404  // Resource not found
  | 409  // Lifecycle or uniqueness conflict
  | 422  // Supplier rejected the request
  | 429  // Rate limited
  | 500  // Unexpected internal error
  | 502  // Supplier failure (upstream unavailable)
  | 504; // Supplier timeout

/**
 * Single authoritative mapping from ErrorCode to HTTP status.
 * Typed as Record<ErrorCode, AllowedHttpStatus> so TypeScript fails at compile
 * time if any code is added without a corresponding status entry.
 */
export const HTTP_STATUS_MAP: Readonly<Record<ErrorCode, AllowedHttpStatus>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LIFECYCLE_CONFLICT: 409,
  DUPLICATE_EMAIL: 409,
  SUPPLIER_REJECTED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SUPPLIER_UNAVAILABLE: 502,
  SUPPLIER_TIMEOUT: 504,
} as const;

/** Resolve an ErrorCode to its canonical HTTP status. */
export function resolveHttpStatus(code: ErrorCode): AllowedHttpStatus {
  return HTTP_STATUS_MAP[code];
}
