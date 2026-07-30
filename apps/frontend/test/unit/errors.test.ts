import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError, parseErrorBody, ErrorCode } from "../../lib/api/errors.js";

describe("ApiError", () => {
  it("creates error with status, code, message", () => {
    const e = new ApiError(404, "not_found", "Resource not found");
    expect(e.status).toBe(404);
    expect(e.code).toBe("not_found");
    expect(e.message).toBe("Resource not found");
    expect(e.name).toBe("ApiError");
    expect(e instanceof Error).toBe(true);
  });

  it("stores fieldErrors", () => {
    const e = new ApiError(422, "validation_failed", "Validation error", { email: "Invalid email" });
    expect(e.fieldErrors?.email).toBe("Invalid email");
  });

  it("defaults retryable to false", () => {
    const e = new ApiError(500, "internal_error", "Error");
    expect(e.retryable).toBe(false);
  });
});

describe("parseErrorBody", () => {
  it("extracts code and message from nested error object", () => {
    const body = { error: { code: "not_found", message: "Not found" } };
    const e = parseErrorBody(404, body);
    expect(e.status).toBe(404);
    expect(e.code).toBe("not_found");
    expect(e.message).toBe("Not found");
  });

  it("falls back for unknown body shape", () => {
    const e = parseErrorBody(500, "plain text");
    expect(e.status).toBe(500);
    expect(e.code).toBe("unknown_error");
  });

  it("handles null body", () => {
    const e = parseErrorBody(503, null);
    expect(e.status).toBe(503);
  });
});
