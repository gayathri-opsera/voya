/**
 * Typed API client for the Voya backend.
 *
 * - Attaches the session access token via Authorization header
 * - Serializes query params
 * - Normalizes all non-2xx responses + network failures to ApiError
 * - Handles 204 No Content gracefully
 */

import { ApiError, parseErrorBody, ErrorCode } from "./errors.js";
import { env } from "../env.js";

// Token provider — injected to allow testing without a real session
let _getToken: () => string | null = () => null;

export function configureAuth(getToken: () => string | null): void {
  _getToken = getToken;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json");
  const token = _getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  let body: unknown;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      body = await res.json();
    } catch {
      throw new ApiError(res.status, ErrorCode.PARSE_ERROR, "Server returned non-JSON body");
    }
  } else {
    try {
      body = await res.text();
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    throw parseErrorBody(res.status, body);
  }

  return body as T;
}

async function executeRequest<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network request failed";
    throw new ApiError(0, ErrorCode.NETWORK_ERROR, message, undefined, true);
  }
  return parseResponse<T>(res);
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  return executeRequest<T>(buildUrl(path, params), {
    method: "GET",
    headers: buildHeaders(),
  });
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  return executeRequest<T>(buildUrl(path, params), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  return executeRequest<T>(buildUrl(path, params), {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T = void>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  return executeRequest<T>(buildUrl(path, params), {
    method: "DELETE",
    headers: buildHeaders(),
  });
}
