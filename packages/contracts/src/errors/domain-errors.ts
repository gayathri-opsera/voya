import { ErrorCode, type ErrorCode as ErrorCodeType } from "./codes.js";

/**
 * Typed domain error class.
 * Services raise AppError instead of constructing HTTP responses inline,
 * keeping route handlers free of status-code logic.
 */
export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly field?: string;

  constructor(code: ErrorCodeType, message: string, field?: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.field = field;
  }
}

/**
 * Factory helpers — one per ErrorCode variant.
 * Each factory returns an AppError with the canonical code pre-set so
 * services never hard-code string error codes.
 */

export function validationFailed(message: string, field?: string): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, message, field);
}

export function unauthenticated(
  message = "Authentication is required to access this resource",
): AppError {
  return new AppError(ErrorCode.UNAUTHENTICATED, message);
}

export function forbidden(
  message = "You do not have permission to perform this action",
): AppError {
  return new AppError(ErrorCode.FORBIDDEN, message);
}

export function notFound(resource: string): AppError {
  return new AppError(ErrorCode.NOT_FOUND, `${resource} was not found`);
}

export function conflict(message: string, field?: string): AppError {
  return new AppError(ErrorCode.CONFLICT, message, field);
}

export function lifecycleConflict(
  currentState: string,
  allowedTransitions: string[],
): AppError {
  return new AppError(
    ErrorCode.LIFECYCLE_CONFLICT,
    `Cannot transition from ${currentState}. Allowed transitions: ${allowedTransitions.join(", ")}`,
  );
}

export function duplicateEmail(): AppError {
  return new AppError(
    ErrorCode.DUPLICATE_EMAIL,
    "An account with this email address already exists",
    "email",
  );
}

export function supplierRejected(reason?: string): AppError {
  return new AppError(
    ErrorCode.SUPPLIER_REJECTED,
    reason ?? "The supplier rejected this request",
  );
}

export function rateLimited(retryAfterSeconds?: number): AppError {
  const message = retryAfterSeconds !== undefined
    ? `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds`
    : "Rate limit exceeded. Please slow down your requests";
  return new AppError(ErrorCode.RATE_LIMITED, message);
}

export function supplierUnavailable(supplierName?: string): AppError {
  const name = supplierName ?? "supplier";
  return new AppError(
    ErrorCode.SUPPLIER_UNAVAILABLE,
    `The ${name} is temporarily unavailable`,
  );
}

export function supplierTimeout(supplierName?: string): AppError {
  const name = supplierName ?? "supplier";
  return new AppError(
    ErrorCode.SUPPLIER_TIMEOUT,
    `Request to ${name} timed out`,
  );
}

export function internalError(): AppError {
  return new AppError(
    ErrorCode.INTERNAL_ERROR,
    "An unexpected error occurred. Please try again or contact support.",
  );
}
