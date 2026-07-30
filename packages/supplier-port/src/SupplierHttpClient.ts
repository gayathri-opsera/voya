/**
 * SupplierHttpClient — shared HTTP wrapper for all supplier adapters.
 *
 * Enforces:
 * - Egress allow-list pre-flight (SSRF protection)
 * - Configurable per-call timeout (default 2200 ms)
 * - Single jittered retry on HTTP 5xx or network error (never on 4xx)
 * - Correlation-ID header propagation
 * - Structured error normalisation to the SupplierError hierarchy
 */

import {
  SupplierTimeoutError,
  SupplierUnavailableError,
  SupplierRejectedRequestError,
  SupplierParseError,
} from "./errors.js";
import type { EgressAllowList } from "./EgressAllowList.js";

export const DEFAULT_TIMEOUT_MS = 2_200;
export const DEFAULT_RETRY_JITTER_MS = 200;

export interface SupplierHttpClientConfig {
  supplierName: string;
  timeoutMs?: number;
  retryJitterMs?: number;
  egressAllowList: EgressAllowList;
  /** Injectable fetch for testing. Defaults to global fetch. */
  fetchFn?: typeof fetch;
  /** Injectable sleep for retry jitter testing. Defaults to setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export interface SupplierRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  correlationId?: string;
}

export class SupplierHttpClient {
  private readonly name: string;
  private readonly timeoutMs: number;
  private readonly retryJitterMs: number;
  private readonly allowList: EgressAllowList;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: SupplierHttpClientConfig) {
    this.name = config.supplierName;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryJitterMs = config.retryJitterMs ?? DEFAULT_RETRY_JITTER_MS;
    this.allowList = config.egressAllowList;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
    this.sleep = config.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async request<T>(url: string, options: SupplierRequestOptions = {}): Promise<T> {
    // Egress pre-flight — must happen before any socket is opened
    this.allowList.check(url);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };
    if (options.correlationId) {
      headers["x-correlation-id"] = options.correlationId;
    }

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    };

    return this._executeWithRetry<T>(url, init, false);
  }

  private async _executeWithRetry<T>(
    url: string,
    init: RequestInit,
    alreadyRetried: boolean,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this._fetchWithTimeout(url, init);
    } catch (err) {
      if (err instanceof SupplierTimeoutError) throw err;
      // Network error — retry once
      if (!alreadyRetried) {
        await this._jitterSleep();
        return this._executeWithRetry<T>(url, init, true);
      }
      throw new SupplierUnavailableError(this.name, undefined, err);
    }

    // 4xx — do not retry
    if (res.status >= 400 && res.status < 500) {
      const message = await this._safeText(res);
      throw new SupplierRejectedRequestError(this.name, res.status, message);
    }

    // 5xx — retry once
    if (res.status >= 500) {
      if (!alreadyRetried) {
        await this._jitterSleep();
        return this._executeWithRetry<T>(url, init, true);
      }
      throw new SupplierUnavailableError(this.name, res.status);
    }

    // 2xx — parse body
    if (res.status === 204) return undefined as T;

    let body: unknown;
    try {
      body = await res.json();
    } catch (e) {
      throw new SupplierParseError(this.name, e);
    }
    if (body === null || body === undefined) {
      throw new SupplierParseError(this.name, new Error("empty response body"));
    }
    return body as T;
  }

  private async _fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(url, { ...init, signal: controller.signal });
      return res;
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        throw new SupplierTimeoutError(this.name, this.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async _jitterSleep(): Promise<void> {
    const jitter = Math.random() * this.retryJitterMs;
    await this.sleep(jitter);
  }

  private async _safeText(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }
}
