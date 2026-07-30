import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiRequest } from "../../lib/api-client";
import { SearchResponseSchema } from "@travel/contracts/search";
import { ErrorCode } from "@travel/contracts";
import { mockSearchResponse } from "../fixtures/search-response";
import { envelope400, envelope502 } from "../fixtures/error-envelopes";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("apiRequest", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns ok:true with parsed data for a 200 response matching the schema", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, mockSearchResponse));
    const result = await apiRequest("/api/flights/search", { method: "POST" }, SearchResponseSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.offers).toHaveLength(2);
      expect(result.data.searchId).toBe("search_01J9X0Y2Z3A4B5C6D7E8F9G0");
    }
  });

  it("returns ok:false with a valid ErrorEnvelope for a 400 response", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(400, envelope400));
    const result = await apiRequest("/api/flights/search", { method: "POST" }, SearchResponseSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.envelope.error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(result.envelope.error.field).toBe("origin");
      expect(result.envelope.reference).toBe("corr_01J9X0Y2Z3A4B5C6D7E8F9G0");
    }
  });

  it("returns ok:false with a valid ErrorEnvelope for a 502 response", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(502, envelope502));
    const result = await apiRequest("/api/flights/search", { method: "POST" }, SearchResponseSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.envelope.error.code).toBe(ErrorCode.SUPPLIER_UNAVAILABLE);
    }
  });

  it("returns ok:false with a generated envelope for a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));
    const result = await apiRequest("/api/flights/search", { method: "POST" }, SearchResponseSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.envelope.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.envelope.reference).toBeTruthy();
    }
  });

  it("returns ok:false when response body is not valid JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new SyntaxError("Unexpected token"); },
    } as unknown as Response);
    const result = await apiRequest("/api/flights/search", { method: "POST" }, SearchResponseSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.envelope.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.envelope.reference).toBeTruthy();
    }
  });

  it("returns ok:false with a generated envelope when 200 response doesn't match schema", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockFetch.mockResolvedValueOnce(mockResponse(200, { unexpected: "shape" }));
    const result = await apiRequest("/api/flights/search", { method: "POST" }, SearchResponseSchema);
    expect(result.ok).toBe(false);
    consoleSpy.mockRestore();
  });
});
