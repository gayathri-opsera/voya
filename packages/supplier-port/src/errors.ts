/**
 * Typed error hierarchy for supplier port failures.
 * Callers map these to HTTP status codes without inspecting raw provider payloads.
 *
 *   SupplierTimeoutError       → 504 Gateway Timeout
 *   SupplierUnavailableError   → 502 Bad Gateway
 *   SupplierRejectedRequest    → 422 Unprocessable Entity
 *   SupplierEgressBlockedError → 502 (security event — host not in allow-list)
 */

export class SupplierError extends Error {
  constructor(
    public readonly supplier: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SupplierError";
  }
}

export class SupplierTimeoutError extends SupplierError {
  constructor(supplier: string, timeoutMs: number) {
    super(supplier, `${supplier}: request timed out after ${timeoutMs}ms`);
    this.name = "SupplierTimeoutError";
  }
}

export class SupplierUnavailableError extends SupplierError {
  constructor(supplier: string, status?: number, cause?: unknown) {
    super(
      supplier,
      `${supplier}: supplier unavailable${status ? ` (HTTP ${status})` : ""}`,
      cause,
    );
    this.name = "SupplierUnavailableError";
  }
}

export class SupplierRejectedRequestError extends SupplierError {
  constructor(supplier: string, status: number, message?: string) {
    super(
      supplier,
      `${supplier}: request rejected (HTTP ${status})${message ? `: ${message}` : ""}`,
    );
    this.name = "SupplierRejectedRequestError";
  }
}

export class SupplierEgressBlockedError extends SupplierError {
  constructor(supplier: string, blockedHost: string) {
    super(
      supplier,
      `${supplier}: egress blocked — host ${blockedHost} is not on the allow-list`,
    );
    this.name = "SupplierEgressBlockedError";
  }
}

export class SupplierParseError extends SupplierError {
  constructor(supplier: string, cause?: unknown) {
    super(supplier, `${supplier}: response payload could not be parsed`, cause);
    this.name = "SupplierParseError";
  }
}
