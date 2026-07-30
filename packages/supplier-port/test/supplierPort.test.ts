import { describe, it, expect, vi, beforeEach } from "vitest";
import { EgressAllowList } from "../src/EgressAllowList.js";
import { SupplierHttpClient } from "../src/SupplierHttpClient.js";
import {
  SupplierEgressBlockedError,
  SupplierTimeoutError,
  SupplierUnavailableError,
  SupplierRejectedRequestError,
} from "../src/errors.js";

// ─── EgressAllowList ──────────────────────────────────────────────────────────

describe("EgressAllowList", () => {
  const list = new EgressAllowList({
    supplierName: "amadeus",
    allowedHosts: new Set(["api.amadeus.com", "hotels.rapidapi.com"]),
  });

  it("passes allow-listed hostname", () => {
    expect(() => list.check("https://api.amadeus.com/v2/search")).not.toThrow();
  });

  it("blocks a non-listed hostname before any network call", () => {
    expect(() => list.check("https://evil.example.com/inject"))
      .toThrow(SupplierEgressBlockedError);
  });

  it("blocks raw IPv4 literals", () => {
    expect(() => list.check("https://192.168.1.1/api")).toThrow(SupplierEgressBlockedError);
  });

  it("blocks raw IPv6 literals", () => {
    expect(() => list.check("https://[::1]/api")).toThrow(SupplierEgressBlockedError);
  });

  it("throws if allowedHosts is empty at construction time", () => {
    expect(() =>
      new EgressAllowList({ supplierName: "test", allowedHosts: new Set() }),
    ).toThrow("allowedHosts must not be empty");
  });

  it("fromEnv parses comma-separated hosts", () => {
    const l = EgressAllowList.fromEnv("amadeus", "api.amadeus.com,hotels.rapidapi.com");
    expect(() => l.check("https://api.amadeus.com/")).not.toThrow();
    expect(() => l.check("https://unknown.com/")).toThrow(SupplierEgressBlockedError);
  });
});

// ─── SupplierHttpClient ───────────────────────────────────────────────────────

function makeAllowList(host: string) {
  return new EgressAllowList({
    supplierName: "test-supplier",
    allowedHosts: new Set([host]),
  });
}

function makeClient(
  fetchFn: typeof fetch,
  sleepFn?: (ms: number) => Promise<void>,
  timeoutMs = 2200,
) {
  return new SupplierHttpClient({
    supplierName: "test-supplier",
    timeoutMs,
    retryJitterMs: 0,
    egressAllowList: makeAllowList("api.example.com"),
    fetchFn,
    sleep: sleepFn ?? (() => Promise.resolve()),
  });
}

const ALLOWED_URL = "https://api.example.com/search";

describe("SupplierHttpClient - success", () => {
  it("returns parsed body on 200", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ offers: [] }),
      text: async () => "",
    } as unknown as Response);

    const client = makeClient(fetchFn);
    const result = await client.request<{ offers: unknown[] }>(ALLOWED_URL);
    expect(result.offers).toEqual([]);
  });

  it("returns undefined on 204", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 204,
      json: async () => null,
      text: async () => "",
    } as unknown as Response);

    const client = makeClient(fetchFn);
    const result = await client.request(ALLOWED_URL);
    expect(result).toBeUndefined();
  });
});

describe("SupplierHttpClient - retry", () => {
  it("retries once on 5xx and succeeds", async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500, json: async () => ({}), text: async () => "" } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => "" } as unknown as Response;
    });

    const client = makeClient(fetchFn);
    const result = await client.request<{ ok: boolean }>(ALLOWED_URL);
    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  it("throws SupplierUnavailableError after two 5xx responses (no more retries)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false, status: 503, json: async () => ({}), text: async () => "",
    } as unknown as Response);

    const client = makeClient(fetchFn);
    await expect(client.request(ALLOWED_URL)).rejects.toThrow(SupplierUnavailableError);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false, status: 422, json: async () => ({}), text: async () => "bad input",
    } as unknown as Response);

    const client = makeClient(fetchFn);
    await expect(client.request(ALLOWED_URL)).rejects.toThrow(SupplierRejectedRequestError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("SupplierHttpClient - timeout", () => {
  it("throws SupplierTimeoutError when request takes longer than timeoutMs", async () => {
    const fetchFn = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        // Simulate abort from the timeout
        const signal = init.signal as AbortSignal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("AbortError");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });

    const client = makeClient(fetchFn, undefined, 10); // 10ms timeout
    await expect(client.request(ALLOWED_URL)).rejects.toThrow(SupplierTimeoutError);
  });
});

describe("SupplierHttpClient - egress blocking", () => {
  it("blocks request to non-allow-listed host before fetch is called", async () => {
    const fetchFn = vi.fn();
    const client = makeClient(fetchFn);

    await expect(client.request("https://evil.example.com/steal"))
      .rejects.toThrow(SupplierEgressBlockedError);

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
