/**
 * Audit payload minimiser.
 *
 * Strips sensitive fields from audit records before persistence.
 * Reuses the same redaction key list as the Pino logger PII paths.
 *
 * Audit rows are excluded from GDPR erasure → they MUST NOT contain
 * identity-document data, credentials, or raw tokens.
 */

const REDACTED_KEYS = new Set([
  "email",
  "passwordHash",
  "password",
  "dateOfBirth",
  "passportNumber",
  "authorization",
  "Authorization",
  "stripe-signature",
  "stripeSignature",
  "refreshToken",
  "accessToken",
  "token",
  "secret",
  "cvv",
  "pan",
  "cardNumber",
]);

const REDACTED_SENTINEL = "[REDACTED]";

export function sanitiseAuditPayload(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;

  if (Array.isArray(input)) {
    return input.map(sanitiseAuditPayload);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) {
      result[key] = REDACTED_SENTINEL;
    } else {
      result[key] = sanitiseAuditPayload(value);
    }
  }
  return result;
}
