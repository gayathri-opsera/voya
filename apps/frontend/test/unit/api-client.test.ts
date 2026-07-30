import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiGet, apiPost, apiPatch, apiDelete, configureAuth } from "../../lib/api/client.js";

// Mock fetch globally
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Mock env
vi.mock("../../lib/env.js", () => ({
  env: { NEXT_PUBLIC_API_BASE_URL: "http://api.test", NODE_ENV: "test" },
}));

function makeResponse(status: number, body: unknown, contentType = "application/json"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    json: async () => body,
    text: async () => String(body),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  configureAuth(() => null);
});

describe("apiGet", () => {
  it("returns parsed body on 200", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, { flights: [] }));
    const result = await apiGet<{ flights: unknown[] }>("/search/flights");
    expect(result.flights).toEqual([]);
  });

  it("throws ApiError on 404", async () => {
    fetchMock.mockResolvedValue(
      makeResponse(404, { error: { code: "not_found", message: "Not found" } }),
    );
    await expect(apiGet("/search/flights")).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("throws ApiError with NETWORK_ERROR on fetch failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiGet("/search/flights")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      retryable: true,
    });
  });

  it("attaches Authorization header when token configured", async () => {
    configureAuth(() => "token_xyz");
    fetchMock.mockResolvedValue(makeResponse(200, {}));
    await apiGet("/me");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token_xyz");
  });

  it("does not send Authorization header when no token", async () => {
    configureAuth(() => null);
    fetchMock.mockResolvedValue(makeResponse(200, {}));
    await apiGet("/public");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("serializes query params into URL", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, {}));
    await apiGet("/search", { origin: "JFK", limit: 10 });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("origin=JFK");
    expect(url).toContain("limit=10");
  });

  it("throws ApiError on 500", async () => {
    fetchMock.mockResolvedValue(
      makeResponse(500, { error: { code: "internal_error", message: "Server error" } }),
    );
    await expect(apiGet("/flights")).rejects.toMatchObject({ status: 500 });
  });
});

describe("apiPost", () => {
  it("sends JSON body and returns parsed response", async () => {
    fetchMock.mockResolvedValue(makeResponse(201, { id: "b1" }));
    const result = await apiPost<{ id: string }>("/bookings", { flightId: "f1" });
    expect(result.id).toBe("b1");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ flightId: "f1" }));
  });
});

describe("apiPatch", () => {
  it("uses PATCH method", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, {}));
    await apiPatch("/bookings/b1", { status: "cancelled" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
  });
});

describe("apiDelete", () => {
  it("uses DELETE method and handles 204", async () => {
    fetchMock.mockResolvedValue(makeResponse(204, null, "text/plain"));
    await expect(apiDelete("/sessions/s1")).resolves.toBeUndefined();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});
