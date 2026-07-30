/**
 * @voya/contracts — Enum test fixtures
 *
 * Valid and invalid values for every exported enum. Used by unit tests to
 * verify that schemas accept correct values and reject unknown or near-miss
 * values without silent coercion.
 *
 * IMPORTANT: These are synthetic test values only. No real identifiers.
 */

// ---------------------------------------------------------------------------
// PathMode fixtures
// ---------------------------------------------------------------------------

export const validPathModes = ['PATH_A', 'PATH_B'] as const;

export const invalidPathModes = [
  'PATH_C',           // non-existent path
  'path_a',           // wrong case — must be rejected
  'PATHA',            // missing underscore
  'path-a',           // hyphen variant
  '',                 // empty string
  'UNKNOWN',
] as const;

// ---------------------------------------------------------------------------
// InventoryDomain fixtures
// ---------------------------------------------------------------------------

export const validInventoryDomains = [
  'ACCOMMODATION',
  'ACTIVITIES',
  'DINING',
  'FLIGHTS',
  'TRANSPORT',
  'WEATHER_ADVISORY',
] as const;

export const invalidInventoryDomains = [
  'ACCOMODATION',     // common misspelling
  'accommodation',    // wrong case
  'HOTEL',            // not a defined domain
  'FOOD',             // near-miss for DINING
  '',
] as const;

// ---------------------------------------------------------------------------
// BookingSource fixtures
// ---------------------------------------------------------------------------

export const validBookingSources = [
  'HVMI',
  'MARRIOTT_BRAND',
  'BONVOY_TOURS_AND_ACTIVITIES',
  'AMADEUS_GDS',
  'MUNICIPAL_PUBLIC',
] as const;

export const invalidBookingSources = [
  'HVMI_PARTNER',     // not exact
  'Marriott_Brand',   // mixed case
  'BOOKING_COM',      // non-Marriott source
  'EXPEDIA',
  '',
] as const;

// ---------------------------------------------------------------------------
// SourceClassification fixtures
// ---------------------------------------------------------------------------

export const validSourceClassifications = [
  'MARRIOTT_OWNED',
  'MARRIOTT_PARTNERED',
  'EXEMPT_PUBLIC',
] as const;

export const invalidSourceClassifications = [
  'THIRD_PARTY',          // explicitly not allowed
  'marriott_owned',       // wrong case
  'OWNED',                // truncated
  'PARTNERED',            // truncated
  '',
] as const;

// ---------------------------------------------------------------------------
// DegradedReason fixtures
// ---------------------------------------------------------------------------

export const validDegradedReasons = [
  'SOURCE_TIMEOUT',
  'SAFETY_GATE_BLOCKED',
  'STALE_DATA',
  'SUPPLIER_UNCERTIFIED',
  'EXCLUSIVITY_FILTER_REMOVED',
  'BUDGET_EXCEEDED',
  'AVAILABILITY_FAILED',
  'FRESHNESS_WINDOW_EXPIRED',
  'UNKNOWN',
] as const;

export const invalidDegradedReasons = [
  'TIMED_OUT',            // near-miss for SOURCE_TIMEOUT
  'DEGRADED',             // generic, not in schema
  'source_timeout',       // wrong case
  '',
] as const;

// ---------------------------------------------------------------------------
// ReceiptOutcome fixtures
// ---------------------------------------------------------------------------

export const validReceiptOutcomes = ['PASS', 'BLOCKED', 'STALE'] as const;

export const invalidReceiptOutcomes = [
  'FAIL',         // near-miss for BLOCKED
  'EXPIRED',      // near-miss for STALE
  'pass',         // wrong case
  'OK',
  '',
] as const;

// ---------------------------------------------------------------------------
// SupplierBookability fixtures
// ---------------------------------------------------------------------------

export const validSupplierBookabilities = [
  'FULLY_BOOKABLE',
  'DEEP_LINK_ONLY',
  'UNAVAILABLE',
] as const;

export const invalidSupplierBookabilities = [
  'BOOKABLE',             // truncated
  'DEEP_LINK',            // truncated
  'fully_bookable',       // wrong case
  'PARTIAL',
  '',
] as const;

// ---------------------------------------------------------------------------
// DataClassificationTier fixtures
// ---------------------------------------------------------------------------

export const validDataClassificationTiers = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
] as const;

export const invalidDataClassificationTiers = [
  'PRIVATE',              // near-miss for CONFIDENTIAL/RESTRICTED
  'SECRET',               // not a defined tier
  'public',               // wrong case
  'CLASSIFIED',
  '',
] as const;

// ---------------------------------------------------------------------------
// AuditEventType fixtures
// ---------------------------------------------------------------------------

export const validAuditEventTypes = [
  'SOURCING_ORDER',
  'BRAND_FALLBACK_DISCLOSURE',
  'SUPPLIER_EXCLUSION',
  'SAFETY_GATE_DECISION',
  'RECEIPT_ISSUED',
  'RECEIPT_STALE_BLOCKED',
  'LOYALTY_SIMULATED_DEBIT',
  'CHECKOUT_AUTHORISATION_TAKEN',
  'CHECKOUT_COMPENSATED',
  'ITINERARY_PRESENTED',
] as const;

export const invalidAuditEventTypes = [
  'SOURCING',             // truncated
  'RECEIPT_CREATED',      // near-miss for RECEIPT_ISSUED
  'CHECKOUT',             // ambiguous
  'sourcing_order',       // wrong case
  '',
] as const;

// ---------------------------------------------------------------------------
// RetentionTrigger fixtures
// ---------------------------------------------------------------------------

export const validRetentionTriggers = [
  'BOOKING_CONFIRMED',
  'CHECKOUT_FAILED',
  'CHECKOUT_COMPENSATED',
  'SESSION_EXPIRED',
  'ACCOUNT_DELETED',
  'AUDIT_RETENTION_OVERRIDE',
] as const;

export const invalidRetentionTriggers = [
  'BOOKING_COMPLETE',     // near-miss for BOOKING_CONFIRMED
  'SESSION_END',          // near-miss for SESSION_EXPIRED
  'booking_confirmed',    // wrong case
  'DELETED',
  '',
] as const;
