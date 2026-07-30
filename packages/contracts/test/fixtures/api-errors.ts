/**
 * @voya/contracts — API error test fixtures
 *
 * IMPORTANT: These fixtures must not contain real secrets, production
 * identifiers, supplier credentials, payment details, Bonvoy member IDs,
 * or traveller PII. All values are synthetic, test-only data.
 */

import type { ApiError, ApiErrorDetail } from '../../src/common/api-error.js';

// ---------------------------------------------------------------------------
// Valid API error fixtures
// ---------------------------------------------------------------------------

/** Minimal valid error — no optional `details` array. */
export const validMinimalApiError: ApiError = {
  code: 'RECEIPT_STALE',
  message: 'The trip confidence receipt has expired. Please refresh your itinerary before continuing.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000001',
};

/** Valid error with a populated `details` array. */
export const validApiErrorWithDetails: ApiError = {
  code: 'INVALID_DATE_RANGE',
  message: 'One or more date fields failed validation.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000002',
  details: [
    {
      field: '/body/dates/checkIn',
      rule: 'min_stay_nights_violated',
      message: 'Check-in date must be at least 1 night before check-out date.',
    },
    {
      field: '/body/dates/checkOut',
      message: 'Check-out date cannot be in the past.',
    },
  ],
};

/** Valid error without `field` in details — rule-level only. */
export const validApiErrorRuleLevelDetail: ApiError = {
  code: 'SOURCING_POLICY_VIOLATION',
  message: 'The requested inventory does not meet Voya sourcing policy.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000003',
  details: [
    {
      rule: 'hvmi_first_not_satisfied',
      message: 'No HVMI-eligible properties were found for this destination before brand fallback was triggered.',
    },
  ],
};

/** Valid 503 error with no details (expected for infrastructure errors). */
export const validGatewayError: ApiError = {
  code: 'UPSTREAM_UNAVAILABLE',
  message: 'A dependent service is temporarily unavailable. Please try again in a few moments.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000004',
};

/** Valid detail item in isolation (used for detail-level tests). */
export const validApiErrorDetail: ApiErrorDetail = {
  field: '/body/party/adults',
  rule: 'min_adults_required',
  message: 'At least one adult must be included in the party.',
};

// ---------------------------------------------------------------------------
// Invalid API error fixtures
// ---------------------------------------------------------------------------

/**
 * Contains an internal `stack` field — must be rejected because .strict()
 * disallows undeclared top-level fields that could leak implementation details.
 */
export const invalidApiErrorWithStack = {
  code: 'INTERNAL_ERROR',
  message: 'Unexpected server error.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000010',
  stack: 'Error: Unexpected server error\n    at Object.<anonymous> (/app/src/handler.ts:42:11)',
};

/**
 * Contains a `stackTrace` field — variant of the above, also must be rejected.
 */
export const invalidApiErrorWithStackTrace = {
  code: 'INTERNAL_ERROR',
  message: 'Unexpected server error.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000011',
  stackTrace: 'TypeError: Cannot read properties of undefined',
};

/**
 * Contains a `token` field — undeclared secret-adjacent field must be rejected.
 */
export const invalidApiErrorWithToken = {
  code: 'AUTH_FAILED',
  message: 'Authentication failed.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000012',
  token: 'eyJhbGciOiJIUzI1NiJ9.test.test',
};

/**
 * Contains a `password` field — must be rejected.
 */
export const invalidApiErrorWithPassword = {
  code: 'AUTH_FAILED',
  message: 'Authentication failed.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000013',
  password: 'hunter2',
};

/**
 * Missing required `correlationId` — must be rejected.
 */
export const invalidApiErrorMissingCorrelationId = {
  code: 'NOT_FOUND',
  message: 'The requested resource was not found.',
};

/**
 * Missing required `code` — must be rejected.
 */
export const invalidApiErrorMissingCode = {
  message: 'The requested resource was not found.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000015',
};

/**
 * Empty string `code` — must be rejected (min(1) constraint).
 */
export const invalidApiErrorEmptyCode = {
  code: '',
  message: 'Something went wrong.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000016',
};

/**
 * Detail item with empty `message` — must be rejected (min(1) constraint).
 */
export const invalidApiErrorDetailEmptyMessage = {
  code: 'VALIDATION_FAILED',
  message: 'Validation failed.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000017',
  details: [
    {
      field: '/body/name',
      message: '',
    },
  ],
};

/**
 * Detail item with an undeclared extra field — strict detail schema must reject it.
 */
export const invalidApiErrorDetailExtraField = {
  code: 'VALIDATION_FAILED',
  message: 'Validation failed.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000018',
  details: [
    {
      field: '/body/name',
      message: 'Name is required.',
      internalDebugInfo: 'column null check failed at row 7',
    },
  ],
};

/**
 * `details` is not an array — must be rejected.
 */
export const invalidApiErrorDetailsNotArray = {
  code: 'VALIDATION_FAILED',
  message: 'Validation failed.',
  correlationId: 'trace-00112233-aabb-ccdd-eeff-000000000019',
  details: 'field /body/name is required',
};
