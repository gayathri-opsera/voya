/**
 * Consumer-style integration test for @voya/contracts
 *
 * This test mimics how a downstream service would consume the package —
 * importing by the workspace package name, serializing a fixture, validating
 * through the shared schema, and asserting inferred TypeScript type compatibility.
 *
 * Requirements validated:
 *  AC5 — serializes a request fixture, validates it through the shared schema,
 *          and asserts the inferred TypeScript type remains compatible with the
 *          exported schema.
 */

import { describe, it, expect } from 'vitest';

// Import by workspace package name exactly as a downstream service would.
// The vitest alias in vitest.config.ts maps '@voya/contracts' → '../src/index.ts'.
import {
  ApiErrorSchema,
  parseApiError,
  type ApiError,
  PathMode,
  PathModeEnum,
  SourceClassification,
  SourceClassificationEnum,
  ReceiptOutcome,
  ReceiptOutcomeEnum,
  AuditEventType,
  AuditEventTypeEnum,
} from '@voya/contracts';

// ---------------------------------------------------------------------------
// Fixture: simulate a serialized wire-format payload as received by a service
// (e.g. from an HTTP response body deserialized from JSON).
// ---------------------------------------------------------------------------

const serializedApiErrorPayload = JSON.stringify({
  code: 'RECEIPT_STALE',
  message:
    'The trip confidence receipt has expired. Please refresh your itinerary before continuing.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000099',
});

const serializedApiErrorWithDetails = JSON.stringify({
  code: 'SOURCING_POLICY_VIOLATION',
  message: 'The requested inventory does not meet Voya sourcing policy.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000100',
  details: [
    {
      rule: 'hvmi_first_not_satisfied',
      message:
        'No HVMI-eligible properties were found for this destination before brand fallback was triggered.',
    },
  ],
});

// ---------------------------------------------------------------------------
// Wire-format round-trip tests
// ---------------------------------------------------------------------------

describe('Consumer integration — API error round-trip', () => {
  it('validates a deserialized JSON payload through ApiErrorSchema', () => {
    const parsed: unknown = JSON.parse(serializedApiErrorPayload);
    const result = ApiErrorSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      // TypeScript type assignment — validates compile-time compatibility.
      const typedError: ApiError = result.data;
      expect(typedError.code).toBe('RECEIPT_STALE');
      expect(typedError.correlationId).toBe('trace-00112233-aabb-ccdd-eeff-000000000099');
    }
  });

  it('validates a deserialized JSON payload with details through parseApiError helper', () => {
    const parsed: unknown = JSON.parse(serializedApiErrorWithDetails);
    const result = parseApiError(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      const typedError: ApiError = result.data;
      expect(typedError.code).toBe('SOURCING_POLICY_VIOLATION');
      expect(typedError.details).toHaveLength(1);
      expect(typedError.details?.[0]?.rule).toBe('hvmi_first_not_satisfied');
    }
  });

  it('rejects a deserialized payload containing a stack trace field', () => {
    const parsed: unknown = JSON.parse(
      JSON.stringify({
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error.',
        correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000101',
        stack: 'Error: Unexpected error\n    at handler.ts:42',
      }),
    );
    const result = parseApiError(parsed);
    expect(result.success).toBe(false);
  });

  it('inferred ApiError type is assignable from a schema-validated parse result', () => {
    const parsed: unknown = JSON.parse(serializedApiErrorPayload);
    const result = ApiErrorSchema.safeParse(parsed);
    if (result.success) {
      // This line would fail TypeScript compilation if ApiError type changed
      // incompatibly with the exported schema — intentionally coupling the two.
      const error: ApiError = result.data;
      expect(typeof error.code).toBe('string');
      expect(typeof error.message).toBe('string');
      expect(typeof error.correlationId).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// Enum consumption tests
// ---------------------------------------------------------------------------

describe('Consumer integration — enum consumption by workspace name', () => {
  it('PathMode enum values are accessible and parse through PathModeEnum schema', () => {
    const pathA = PathMode.PATH_A;
    const result = PathModeEnum.safeParse(pathA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('PATH_A');
    }
  });

  it('SourceClassification enum values pass schema validation', () => {
    const owned = SourceClassification.MARRIOTT_OWNED;
    expect(SourceClassificationEnum.safeParse(owned).success).toBe(true);
  });

  it('ReceiptOutcome PASS parses through ReceiptOutcomeEnum', () => {
    expect(ReceiptOutcomeEnum.safeParse(ReceiptOutcome.PASS).success).toBe(true);
  });

  it('AuditEventType RECEIPT_ISSUED parses through AuditEventTypeEnum', () => {
    expect(AuditEventTypeEnum.safeParse(AuditEventType.RECEIPT_ISSUED).success).toBe(true);
  });

  it('a serialized enum value round-trips through JSON deserialization correctly', () => {
    const payload = JSON.stringify({ outcome: ReceiptOutcome.STALE });
    const deserialized = JSON.parse(payload) as { outcome: unknown };
    expect(ReceiptOutcomeEnum.safeParse(deserialized.outcome).success).toBe(true);
  });

  it('a serialized unknown enum value is rejected after deserialization', () => {
    const payload = JSON.stringify({ outcome: 'EXPIRED' });
    const deserialized = JSON.parse(payload) as { outcome: unknown };
    expect(ReceiptOutcomeEnum.safeParse(deserialized.outcome).success).toBe(false);
  });
});
