/**
 * Typed log context — no index signature, satisfying the Type Safety policy.
 * All fields are optional so child loggers can provide partial context.
 */
export interface LogContext {
  correlationId?: string;
  traceId?: string;
  userId?: string;
  service?: string;
  operation?: string;
  resource?: string;
  supplierName?: string;
  bookingId?: string;
}
