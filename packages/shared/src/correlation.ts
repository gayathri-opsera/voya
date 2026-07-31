/**
 * Correlation ID propagation — WO-007: Propagate correlation IDs across service calls.
 *
 * Every inbound request gets/generates a correlation ID (x-correlation-id header).
 * The ID is:
 * - Propagated to all outbound service calls
 * - Injected into all log entries for the request
 * - Exposed in error response headers for client-side debugging
 * - Validated as a UUID v4 (fallback: generate new one)
 */

import { randomUUID } from "crypto";

export const CORRELATION_ID_HEADER = "x-correlation-id";
export const TRACE_ID_HEADER = "x-trace-id";
export const REQUEST_ID_HEADER = "x-request-id";

export interface CorrelationContext {
  correlationId: string;
  requestId: string;
  traceId?: string;
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validates and normalizes a correlation ID, generating a new one if invalid. */
export function resolveCorrelationId(raw: string | undefined): string {
  if (raw && UUID_V4_PATTERN.test(raw)) return raw;
  return randomUUID();
}

/** Creates a correlation context from an incoming request. */
export function extractCorrelationContext(headers: Record<string, string | string[] | undefined>): CorrelationContext {
  const getHeader = (key: string): string | undefined => {
    const val = headers[key];
    return Array.isArray(val) ? val[0] : val;
  };

  return {
    correlationId: resolveCorrelationId(getHeader(CORRELATION_ID_HEADER)),
    requestId: randomUUID(),
    traceId: getHeader(TRACE_ID_HEADER),
  };
}

/** Builds outbound headers for service-to-service calls, propagating correlation context. */
export function buildPropagationHeaders(ctx: CorrelationContext): Record<string, string> {
  const headers: Record<string, string> = {
    [CORRELATION_ID_HEADER]: ctx.correlationId,
    [REQUEST_ID_HEADER]: ctx.requestId,
  };
  if (ctx.traceId) headers[TRACE_ID_HEADER] = ctx.traceId;
  return headers;
}
