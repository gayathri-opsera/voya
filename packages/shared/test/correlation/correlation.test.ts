import { describe, it, expect } from "vitest";
import {
  resolveCorrelationId,
  extractCorrelationContext,
  buildPropagationHeaders,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
} from "../../src/correlation.ts";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Correlation ID propagation", () => {
  it("returns provided valid UUID v4", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(resolveCorrelationId(id)).toBe(id);
  });

  it("generates a new UUID when provided value is invalid", () => {
    const result = resolveCorrelationId("not-a-uuid");
    expect(result).toMatch(UUID_V4);
    expect(result).not.toBe("not-a-uuid");
  });

  it("generates a new UUID when no value provided", () => {
    const result = resolveCorrelationId(undefined);
    expect(result).toMatch(UUID_V4);
  });

  it("extracts correlation ID from request headers", () => {
    const ctx = extractCorrelationContext({
      "x-correlation-id": "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(ctx.correlationId).toBe("123e4567-e89b-42d3-a456-426614174000");
  });

  it("generates fresh correlation ID for missing header", () => {
    const ctx = extractCorrelationContext({});
    expect(ctx.correlationId).toMatch(UUID_V4);
  });

  it("propagation headers include correlation ID", () => {
    const ctx = { correlationId: "abc-id-123", requestId: "req-456" };
    const headers = buildPropagationHeaders(ctx as any);
    expect(headers[CORRELATION_ID_HEADER]).toBe("abc-id-123");
    expect(headers[REQUEST_ID_HEADER]).toBeDefined();
  });
});
