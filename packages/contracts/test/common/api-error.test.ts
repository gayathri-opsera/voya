/**
 * Unit tests for @voya/contracts — API error envelope
 *
 * Tests cover:
 *  - Schema success paths for minimal and full ApiError shapes
 *  - Validation failures for missing required fields
 *  - Strict-mode rejection of undeclared top-level fields (stack traces, secrets)
 *  - Strict-mode rejection of undeclared detail fields
 *  - parseApiError helper returning typed results without throwing
 *  - Detail item validation (empty message, missing both field and rule)
 */

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  ApiErrorSchema,
  ApiErrorDetailSchema,
  parseApiError,
} from '../../src/common/api-error.js';
import {
  validMinimalApiError,
  validApiErrorWithDetails,
  validApiErrorRuleLevelDetail,
  validGatewayError,
  validApiErrorDetail,
  invalidApiErrorWithStack,
  invalidApiErrorWithStackTrace,
  invalidApiErrorWithToken,
  invalidApiErrorWithPassword,
  invalidApiErrorMissingCorrelationId,
  invalidApiErrorMissingCode,
  invalidApiErrorEmptyCode,
  invalidApiErrorDetailEmptyMessage,
  invalidApiErrorDetailExtraField,
  invalidApiErrorDetailsNotArray,
} from '../fixtures/api-errors.js';

// ---------------------------------------------------------------------------
// ApiErrorDetailSchema
// ---------------------------------------------------------------------------

describe('ApiErrorDetailSchema', () => {
  it('accepts a full detail with field, rule, and message', () => {
    const result = ApiErrorDetailSchema.safeParse(validApiErrorDetail);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.field).toBe('/body/party/adults');
      expect(result.data.rule).toBe('min_adults_required');
      expect(result.data.message).toBe('At least one adult must be included in the party.');
    }
  });

  it('accepts a detail with only message (field and rule are optional)', () => {
    const result = ApiErrorDetailSchema.safeParse({ message: 'Generic constraint violated.' });
    expect(result.success).toBe(true);
  });

  it('accepts a detail with only field and message', () => {
    const result = ApiErrorDetailSchema.safeParse({ field: '/body/name', message: 'Name is required.' });
    expect(result.success).toBe(true);
  });

  it('rejects a detail with empty message', () => {
    const result = ApiErrorDetailSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('message');
    }
  });

  it('rejects a detail with an undeclared field (strict mode)', () => {
    const result = ApiErrorDetailSchema.safeParse({
      message: 'Something failed.',
      internalDebugInfo: 'column null at row 7',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ApiErrorSchema — success paths
// ---------------------------------------------------------------------------

describe('ApiErrorSchema — valid envelopes', () => {
  it('parses a minimal valid error (no details)', () => {
    const result = ApiErrorSchema.safeParse(validMinimalApiError);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('RECEIPT_STALE');
      expect(result.data.correlationId).toBe('trace-00112233-aabb-ccdd-eeff-000000000001');
      expect(result.data.details).toBeUndefined();
    }
  });

  it('parses a valid error with a details array', () => {
    const result = ApiErrorSchema.safeParse(validApiErrorWithDetails);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.details).toHaveLength(2);
      expect(result.data.details?.[0]?.field).toBe('/body/dates/checkIn');
    }
  });

  it('parses a valid error with rule-level detail (no field)', () => {
    const result = ApiErrorSchema.safeParse(validApiErrorRuleLevelDetail);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.details?.[0]?.rule).toBe('hvmi_first_not_satisfied');
      expect(result.data.details?.[0]?.field).toBeUndefined();
    }
  });

  it('parses a valid infrastructure-level error with no details', () => {
    const result = ApiErrorSchema.safeParse(validGatewayError);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('UPSTREAM_UNAVAILABLE');
    }
  });
});

// ---------------------------------------------------------------------------
// ApiErrorSchema — rejection of undeclared top-level fields
// ---------------------------------------------------------------------------

describe('ApiErrorSchema — strict rejection of undeclared fields', () => {
  it('rejects an error envelope containing a stack field', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorWithStack);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('rejects an error envelope containing a stackTrace field', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorWithStackTrace);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('rejects an error envelope containing a token field', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorWithToken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('rejects an error envelope containing a password field', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorWithPassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ApiErrorSchema — missing required fields
// ---------------------------------------------------------------------------

describe('ApiErrorSchema — required field validation', () => {
  it('rejects an error missing correlationId', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorMissingCorrelationId);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('correlationId');
    }
  });

  it('rejects an error missing code', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorMissingCode);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('code');
    }
  });

  it('rejects an error with an empty code string', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorEmptyCode);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('code');
    }
  });

  it('rejects an error where details contains an item with empty message', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorDetailEmptyMessage);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('rejects an error where details contains an item with an undeclared extra field', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorDetailExtraField);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('rejects an error where details is a string instead of an array', () => {
    const result = ApiErrorSchema.safeParse(invalidApiErrorDetailsNotArray);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseApiError helper
// ---------------------------------------------------------------------------

describe('parseApiError helper', () => {
  it('returns { success: true, data } for a valid envelope', () => {
    const result = parseApiError(validMinimalApiError);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('RECEIPT_STALE');
    }
  });

  it('returns { success: false, error: ZodError } for an invalid envelope without throwing', () => {
    expect(() => {
      const result = parseApiError(invalidApiErrorWithStack);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
      }
    }).not.toThrow();
  });

  it('returns { success: false } for null input', () => {
    const result = parseApiError(null);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } for a plain string', () => {
    const result = parseApiError('something went wrong');
    expect(result.success).toBe(false);
  });

  it('returns { success: false } for an empty object', () => {
    const result = parseApiError({});
    expect(result.success).toBe(false);
  });

  it('error result contains ZodError issues describing missing fields', () => {
    const result = parseApiError(invalidApiErrorMissingCorrelationId);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('correlationId');
    }
  });

  it('preserves all valid fields in the parsed data', () => {
    const result = parseApiError(validApiErrorWithDetails);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe(validApiErrorWithDetails.code);
      expect(result.data.message).toBe(validApiErrorWithDetails.message);
      expect(result.data.correlationId).toBe(validApiErrorWithDetails.correlationId);
      expect(result.data.details).toHaveLength(2);
    }
  });
});
