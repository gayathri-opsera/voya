/**
 * @voya/contracts — Data category and governance test fixtures
 *
 * IMPORTANT: These fixtures must not contain real secrets, production
 * identifiers, supplier credentials, payment details, Bonvoy member IDs,
 * or traveller PII. All values are synthetic, test-only data.
 */

import type { DataCategoryEntry } from '../../src/governance/data-classification.js';
import type { RetentionPolicy } from '../../src/governance/retention-policy.js';
import type { GovernanceError, CategoryAnnotation } from '../../src/governance/prompt-safety.js';

// ---------------------------------------------------------------------------
// Safe data category entries — tokenised references, prompt-eligible
// ---------------------------------------------------------------------------

/**
 * Synthetic TRAVELLER_TOKEN entry fixture: opaque token, no embedded PII,
 * INTERNAL tier, prompt-eligible.
 */
export const safeTravellerTokenEntry: DataCategoryEntry = {
  key: 'TRAVELLER_TOKEN',
  description: 'Opaque, non-reversible tokenised reference to a synthetic test traveller account.',
  tier: 'INTERNAL',
  promptEligible: true,
  requiresEncryption: false,
  requiresLogMasking: false,
  requiresNonProdAnonymization: false,
  retentionPolicyKey: 'SESSION_LIFETIME',
};

/**
 * Synthetic TRIP_CONSTRAINTS entry fixture: structured constraints using only
 * tokenised references, INTERNAL tier, prompt-eligible.
 */
export const safeTripConstraintsEntry: DataCategoryEntry = {
  key: 'TRIP_CONSTRAINTS',
  description:
    'Structured itinerary constraints with synthetic destination token, date window, ' +
    'party size, and budget band. No PII embedded.',
  tier: 'INTERNAL',
  promptEligible: true,
  requiresEncryption: false,
  requiresLogMasking: false,
  requiresNonProdAnonymization: false,
  retentionPolicyKey: 'SESSION_LIFETIME',
};

// ---------------------------------------------------------------------------
// Prohibited data category entries — PII, payment, passport
// ---------------------------------------------------------------------------

/**
 * Synthetic TRAVELLER_IDENTITY entry fixture: CONFIDENTIAL, not prompt-eligible.
 * Represents the kind of data that must never appear in a prompt payload.
 */
export const prohibitedTravellerIdentityEntry: DataCategoryEntry = {
  key: 'TRAVELLER_IDENTITY',
  description: 'Synthetic traveller name, email, and phone — CONFIDENTIAL, not prompt-eligible.',
  tier: 'CONFIDENTIAL',
  promptEligible: false,
  requiresEncryption: true,
  requiresLogMasking: true,
  requiresNonProdAnonymization: true,
  retentionPolicyKey: 'TRAVELLER_PII_POST_BOOKING',
};

/**
 * Synthetic PASSPORT_NATIONALITY entry fixture: RESTRICTED, not prompt-eligible.
 */
export const prohibitedPassportEntry: DataCategoryEntry = {
  key: 'PASSPORT_NATIONALITY',
  description: 'Synthetic passport number and nationality — RESTRICTED, never in logs or prompts.',
  tier: 'RESTRICTED',
  promptEligible: false,
  requiresEncryption: true,
  requiresLogMasking: true,
  requiresNonProdAnonymization: true,
  retentionPolicyKey: 'GOVT_ID_SHORT_RETENTION',
};

/**
 * Synthetic PAYMENT_TOKEN entry fixture: RESTRICTED, not prompt-eligible.
 */
export const prohibitedPaymentTokenEntry: DataCategoryEntry = {
  key: 'PAYMENT_TOKEN',
  description: 'Synthetic Stripe PaymentMethod ID placeholder — RESTRICTED, never in logs or prompts.',
  tier: 'RESTRICTED',
  promptEligible: false,
  requiresEncryption: true,
  requiresLogMasking: true,
  requiresNonProdAnonymization: true,
  retentionPolicyKey: 'PAYMENT_TOKEN_POST_CHECKOUT',
};

// ---------------------------------------------------------------------------
// Invalid entry fixtures — for validation testing
// ---------------------------------------------------------------------------

/**
 * A RESTRICTED entry that incorrectly omits all protection requirements.
 * Used to test validateDataCategoryEntry rejection.
 */
export const invalidRestrictedEntryMissingProtections: DataCategoryEntry = {
  key: 'PASSPORT_NATIONALITY',
  description: 'Invalid: RESTRICTED entry without required protection metadata.',
  tier: 'RESTRICTED',
  promptEligible: false,
  requiresEncryption: false,  // INVALID — RESTRICTED must be true
  requiresLogMasking: false,  // INVALID — RESTRICTED must be true
  requiresNonProdAnonymization: false, // INVALID — RESTRICTED must be true
  retentionPolicyKey: 'GOVT_ID_SHORT_RETENTION',
};

/**
 * A CONFIDENTIAL entry incorrectly marked as prompt-eligible.
 * Used to test validateDataCategoryEntry rejection.
 */
export const invalidConfidentialPromptEligibleEntry: DataCategoryEntry = {
  key: 'TRAVELLER_IDENTITY',
  description: 'Invalid: CONFIDENTIAL entry incorrectly marked prompt-eligible.',
  tier: 'CONFIDENTIAL',
  promptEligible: true, // INVALID — CONFIDENTIAL must not be prompt-eligible
  requiresEncryption: true,
  requiresLogMasking: true,
  requiresNonProdAnonymization: true,
  retentionPolicyKey: 'TRAVELLER_PII_POST_BOOKING',
};

/**
 * A RESTRICTED entry incorrectly marked as prompt-eligible.
 * Used to test validateDataCategoryEntry rejection.
 */
export const invalidRestrictedPromptEligibleEntry: DataCategoryEntry = {
  key: 'PAYMENT_TOKEN',
  description: 'Invalid: RESTRICTED entry incorrectly marked prompt-eligible.',
  tier: 'RESTRICTED',
  promptEligible: true, // INVALID — RESTRICTED must not be prompt-eligible
  requiresEncryption: true,
  requiresLogMasking: true,
  requiresNonProdAnonymization: true,
  retentionPolicyKey: 'PAYMENT_TOKEN_POST_CHECKOUT',
};

// ---------------------------------------------------------------------------
// Provisional retention policy fixtures
// ---------------------------------------------------------------------------

/**
 * A valid provisional retention policy fixture.
 * Used to verify that provisional policies parse successfully and are visibly
 * marked as PROVISIONAL.
 */
export const provisionalRetentionPolicyFixture: RetentionPolicy = {
  policyKey: 'TEST_PROVISIONAL_POLICY',
  description: 'Synthetic provisional retention policy for unit testing.',
  durationDays: 365,
  eventAnchor: 'BOOKING_CONFIRMED',
  action: 'DELETE',
  approvalStatus: 'PROVISIONAL',
  owner: 'test-team',
  notes: 'Synthetic fixture. Not for production use.',
};

/**
 * An approved retention policy fixture.
 * Used to distinguish approved from provisional in tests.
 */
export const approvedRetentionPolicyFixture: RetentionPolicy = {
  policyKey: 'TEST_APPROVED_POLICY',
  description: 'Synthetic approved retention policy for unit testing.',
  durationDays: 90,
  eventAnchor: 'SESSION_EXPIRED',
  action: 'DELETE',
  approvalStatus: 'APPROVED',
  owner: 'test-team',
  notes: 'Synthetic fixture. Not for production use.',
};

// ---------------------------------------------------------------------------
// Invalid retention policy fixtures — for parse rejection tests
// ---------------------------------------------------------------------------

/**
 * Missing required eventAnchor field — must fail validation because purge
 * timing would be ambiguous without an anchor event.
 */
export const invalidRetentionPolicyMissingAnchor = {
  policyKey: 'TEST_NO_ANCHOR',
  description: 'Invalid policy: no event anchor supplied.',
  durationDays: 180,
  // eventAnchor: intentionally omitted
  action: 'DELETE',
  approvalStatus: 'PROVISIONAL',
  owner: 'test-team',
};

/**
 * Negative durationDays — must be rejected.
 */
export const invalidRetentionPolicyNegativeDuration = {
  policyKey: 'TEST_NEGATIVE_DURATION',
  description: 'Invalid policy: negative duration.',
  durationDays: -30,
  eventAnchor: 'SESSION_EXPIRED',
  action: 'DELETE',
  approvalStatus: 'PROVISIONAL',
  owner: 'test-team',
};

/**
 * Zero durationDays — must be rejected (must be positive).
 */
export const invalidRetentionPolicyZeroDuration = {
  policyKey: 'TEST_ZERO_DURATION',
  description: 'Invalid policy: zero duration.',
  durationDays: 0,
  eventAnchor: 'SESSION_EXPIRED',
  action: 'DELETE',
  approvalStatus: 'PROVISIONAL',
  owner: 'test-team',
};

/**
 * Non-integer durationDays — must be rejected.
 */
export const invalidRetentionPolicyFloatDuration = {
  policyKey: 'TEST_FLOAT_DURATION',
  description: 'Invalid policy: float duration.',
  durationDays: 30.5,
  eventAnchor: 'SESSION_EXPIRED',
  action: 'DELETE',
  approvalStatus: 'PROVISIONAL',
  owner: 'test-team',
};

// ---------------------------------------------------------------------------
// Prompt-safety annotation fixtures
// ---------------------------------------------------------------------------

/**
 * Safe annotations: only TRAVELLER_TOKEN and TRIP_CONSTRAINTS.
 * Used to verify that a prompt-safe payload passes validation.
 */
export const safePromptAnnotations: CategoryAnnotation[] = [
  { categoryKey: 'TRAVELLER_TOKEN', fieldPath: '/constraints/travellerToken' },
  { categoryKey: 'TRIP_CONSTRAINTS', fieldPath: '/constraints' },
];

/**
 * Prohibited annotation: TRAVELLER_IDENTITY (CONFIDENTIAL).
 * Used to verify that a CONFIDENTIAL field is rejected.
 */
export const prohibitedIdentityAnnotation: CategoryAnnotation = {
  categoryKey: 'TRAVELLER_IDENTITY',
  fieldPath: '/traveller/fullName',
};

/**
 * Prohibited annotation: PASSPORT_NATIONALITY (RESTRICTED).
 * Used to verify that a RESTRICTED field is rejected.
 */
export const prohibitedPassportAnnotation: CategoryAnnotation = {
  categoryKey: 'PASSPORT_NATIONALITY',
  fieldPath: '/traveller/passportNumber',
};

/**
 * Mixed annotations: safe and prohibited combined.
 * Used to verify that only the prohibited entries produce errors.
 */
export const mixedPromptAnnotations: CategoryAnnotation[] = [
  { categoryKey: 'TRAVELLER_TOKEN', fieldPath: '/constraints/travellerToken' },
  { categoryKey: 'TRIP_CONSTRAINTS', fieldPath: '/constraints' },
  { categoryKey: 'TRAVELLER_IDENTITY', fieldPath: '/traveller/fullName' },
  { categoryKey: 'PASSPORT_NATIONALITY', fieldPath: '/traveller/passportNumber' },
];

// ---------------------------------------------------------------------------
// Anonymized non-production example data
// All values are synthetic; no real traveller, Bonvoy, payment, or supplier IDs.
// ---------------------------------------------------------------------------

/**
 * Anonymized non-production TripConstraints fixture.
 * Field values use synthetic tokens only. Safe for test, CI, and demo usage.
 */
export const anonymizedTripConstraintsFixture = {
  travellerToken: 'tok_test_traveller_00000000000001', // synthetic opaque token
  destinationToken: 'dst_test_lisbon_pt_00000001',     // synthetic destination token
  dateWindow: {
    checkIn: '2026-09-01',
    checkOut: '2026-09-08',
  },
  partyComposition: {
    adults: 2,
    children: 0,
  },
  budgetBand: 'MID',
  interestTags: ['beach', 'culture', 'dining'],
} as const;

/**
 * Anonymized non-production audit event fixture.
 * Used to simulate a sourcing audit record in integration-style tests.
 */
export const anonymizedAuditEventFixture = {
  eventType: 'SOURCING_ORDER',
  sessionId: 'sess_test_00000000000001', // synthetic session ID
  travellerToken: 'tok_test_traveller_00000000000001',
  connectorOrder: ['HVMI', 'MARRIOTT_BRAND'],
  hvmiResultCount: 3,
  brandFallbackTriggered: false,
  timestamp: '2026-09-01T10:00:00Z',
} as const;

/**
 * Anonymized supplier capability manifest fixture.
 * Uses synthetic supplier IDs.
 */
export const anonymizedSupplierManifestFixture = {
  supplierId: 'sup_test_hvmi_00000001', // synthetic supplier ID
  supplierName: 'Test HVMI Connector (synthetic)',
  bookability: 'FULLY_BOOKABLE',
  refreshLatencySeconds: 300,
  cancellationSemantics: 'FULL_REFUND_72H',
  fixturePassingBookCancel: true,
} as const;
