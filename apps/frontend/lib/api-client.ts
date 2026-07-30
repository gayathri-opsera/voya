import { type ZodTypeAny } from "zod";
import {
  ErrorEnvelopeSchema,
  type ErrorEnvelope,
  ErrorCode,
} from "@travel/contracts";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; envelope: ErrorEnvelope };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/**
 * Makes a fallback error envelope for non-JSON or network failures.
 * The reference is always populated so support can identify the session.
 */
function makeNetworkErrorEnvelope(message: string): ErrorEnvelope {
  const reference = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `ref-${Date.now()}`;
  return {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message,
    },
    reference,
  };
}

/**
 * Typed API client wrapper.
 *
 * - Success paths: parses response body against `successSchema`
 * - Error paths (non-2xx): parses response body against ErrorEnvelopeSchema
 * - Non-JSON or network errors: returns a generated error envelope
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit,
  successSchema: ZodTypeAny,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (networkErr) {
    const message = networkErr instanceof Error
      ? networkErr.message
      : "Network request failed";
    return { ok: false, envelope: makeNetworkErrorEnvelope(message) };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return {
      ok: false,
      envelope: makeNetworkErrorEnvelope(
        "The server returned an unreadable response",
      ),
    };
  }

  if (!response.ok) {
    const envelopeResult = ErrorEnvelopeSchema.safeParse(json);
    if (envelopeResult.success) {
      return { ok: false, envelope: envelopeResult.data };
    }
    return {
      ok: false,
      envelope: makeNetworkErrorEnvelope(
        `Unexpected server error (status ${response.status})`,
      ),
    };
  }

  const parseResult = successSchema.safeParse(json);
  if (!parseResult.success) {
    console.error("Response schema mismatch:", parseResult.error.issues);
    return {
      ok: false,
      envelope: makeNetworkErrorEnvelope(
        "The server returned an unexpected response shape",
      ),
    };
  }

  return { ok: true, data: parseResult.data as T };
}
