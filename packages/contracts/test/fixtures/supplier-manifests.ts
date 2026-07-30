/**
 * @voya/contracts — Supplier Capability Manifest test fixtures
 *
 * IMPORTANT: These fixtures must not contain real sandbox credentials,
 * raw fixture execution logs, confidential supplier contracts, or any
 * production identifiers. All supplierId values are synthetic references.
 *
 * Certification status here means contract-level readiness metadata only.
 * It does not assert production approval.
 */

import type { SupplierCapabilityManifest } from '../../src/supplier/capability-manifest.js';

// ---------------------------------------------------------------------------
// Certified, fully-bookable supplier manifests
// ---------------------------------------------------------------------------

/**
 * HVMI (Homes and Villas by Marriott Bonvoy) — primary accommodation connector.
 * Queried first for every accommodation search per the HVMI-first sourcing rule.
 */
export const hvmiManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_hvmi_accommodation_001',
  displayName: 'Homes and Villas by Marriott Bonvoy (synthetic)',
  domain: 'ACCOMMODATION',
  sourceClassification: 'MARRIOTT_PARTNERED',
  bookabilityMode: 'FULLY_BOOKABLE',
  availabilityRefreshLatencySeconds: 300, // 5-minute availability window
  rateRefreshLatencySeconds: 120,          // 2-minute rate window
  isPriced: true,
  cancellationSemantics: 'FULL_REFUND_72H',
  refundSemantics: 'AUTOMATIC_PLATFORM_REVERSAL',
  supportedOperations: ['QUOTE', 'HOLD', 'COMMIT', 'REVERSE'],
  certificationStatus: 'CERTIFIED',
  fixtureEvidence: {
    fixtureId: 'fix_test_hvmi_book_cancel_001',
    bookOutcome: 'PASS',
    cancelOutcome: 'PASS',
    testedAt: '2026-07-01T09:00:00Z',
    testedByAgent: 'fixture-runner-v1',
    notes: 'Synthetic fixture. Not a real sandbox execution.',
  },
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

/**
 * Marriott brand fallback — brand-direct accommodation used when HVMI has
 * no eligible results. Triggers a disclosure event in the audit ledger.
 */
export const marriottBrandManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_marriott_brand_accommodation_001',
  displayName: 'Marriott Brand Direct (synthetic)',
  domain: 'ACCOMMODATION',
  sourceClassification: 'MARRIOTT_OWNED',
  bookabilityMode: 'FULLY_BOOKABLE',
  availabilityRefreshLatencySeconds: 300,
  rateRefreshLatencySeconds: 120,
  isPriced: true,
  cancellationSemantics: 'FULL_REFUND_24H',
  refundSemantics: 'AUTOMATIC_PLATFORM_REVERSAL',
  supportedOperations: ['QUOTE', 'HOLD', 'COMMIT', 'REVERSE'],
  certificationStatus: 'CERTIFIED',
  fixtureEvidence: {
    fixtureId: 'fix_test_brand_book_cancel_001',
    bookOutcome: 'PASS',
    cancelOutcome: 'PASS',
    testedAt: '2026-07-01T09:30:00Z',
    testedByAgent: 'fixture-runner-v1',
    notes: 'Synthetic fixture. Not a real sandbox execution.',
  },
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

/**
 * Amadeus GDS — flight inventory connector.
 * Provides flight search and booking via the Amadeus GDS.
 * Short refresh latency reflects the dynamic nature of flight availability.
 */
export const amadeusManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_amadeus_gds_flights_001',
  displayName: 'Amadeus GDS Flights (synthetic)',
  domain: 'FLIGHTS',
  sourceClassification: 'MARRIOTT_PARTNERED',
  bookabilityMode: 'FULLY_BOOKABLE',
  availabilityRefreshLatencySeconds: 60,  // 1-minute window; flight inventory is very dynamic
  rateRefreshLatencySeconds: 60,
  isPriced: true,
  cancellationSemantics: 'PARTIAL_REFUND',
  refundSemantics: 'SUPPLIER_INITIATED',  // Airlines manage their own refund processes
  supportedOperations: ['QUOTE', 'HOLD', 'COMMIT', 'REVERSE'],
  certificationStatus: 'CERTIFIED',
  fixtureEvidence: {
    fixtureId: 'fix_test_amadeus_book_cancel_001',
    bookOutcome: 'PASS',
    cancelOutcome: 'PASS',
    testedAt: '2026-07-01T09:45:00Z',
    testedByAgent: 'fixture-runner-v1',
    notes: 'Synthetic fixture. Not a real sandbox execution.',
  },
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

/**
 * Bonvoy Tours and Activities — experiences and dining connector.
 * Longer refresh latency than accommodation; activity availability changes less rapidly.
 */
export const bonvoyToursManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_bonvoy_tours_activities_001',
  displayName: 'Bonvoy Tours and Activities (synthetic)',
  domain: 'ACTIVITIES',
  sourceClassification: 'MARRIOTT_PARTNERED',
  bookabilityMode: 'FULLY_BOOKABLE',
  availabilityRefreshLatencySeconds: 600, // 10-minute window
  rateRefreshLatencySeconds: 300,          // 5-minute rate window
  isPriced: true,
  cancellationSemantics: 'FULL_REFUND_24H',
  refundSemantics: 'AUTOMATIC_PLATFORM_REVERSAL',
  supportedOperations: ['QUOTE', 'HOLD', 'COMMIT', 'REVERSE'],
  certificationStatus: 'CERTIFIED',
  fixtureEvidence: {
    fixtureId: 'fix_test_bonvoy_tours_book_cancel_001',
    bookOutcome: 'PASS',
    cancelOutcome: 'PASS',
    testedAt: '2026-07-01T09:15:00Z',
    testedByAgent: 'fixture-runner-v1',
    notes: 'Synthetic fixture. Not a real sandbox execution.',
  },
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

// ---------------------------------------------------------------------------
// Exempt public landmark manifest (non-bookable, non-priced)
// ---------------------------------------------------------------------------

/**
 * Public/municipal landmark content — exempt from exclusivity filter and
 * certification requirements. Must not be priced or fully bookable.
 */
export const publicLandmarkManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_municipal_landmark_001',
  displayName: 'Municipal and Public Landmark Content (synthetic)',
  domain: 'ACTIVITIES',
  sourceClassification: 'EXEMPT_PUBLIC',
  bookabilityMode: 'DEEP_LINK_ONLY',
  availabilityRefreshLatencySeconds: 86400, // 24-hour window; landmark data changes rarely
  rateRefreshLatencySeconds: undefined,
  isPriced: false,
  cancellationSemantics: 'NOT_APPLICABLE',
  refundSemantics: 'NOT_APPLICABLE',
  supportedOperations: ['DEEP_LINK'],
  certificationStatus: 'UNCERTIFIED', // Not subject to book+cancel certification
  fixtureEvidence: undefined,
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

// ---------------------------------------------------------------------------
// Invalid / edge-case fixtures for testing
// ---------------------------------------------------------------------------

/**
 * Uncertified supplier — FULLY_BOOKABLE but no passing fixture evidence.
 * Must be excluded from traveller-visible inventory.
 */
export const uncertifiedSupplierManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_uncertified_accommodation_001',
  displayName: 'Uncertified Accommodation Partner (synthetic)',
  domain: 'ACCOMMODATION',
  sourceClassification: 'MARRIOTT_PARTNERED',
  bookabilityMode: 'FULLY_BOOKABLE',
  availabilityRefreshLatencySeconds: 300,
  rateRefreshLatencySeconds: 120,
  isPriced: true,
  cancellationSemantics: 'FULL_REFUND_72H',
  refundSemantics: 'AUTOMATIC_PLATFORM_REVERSAL',
  supportedOperations: ['QUOTE', 'HOLD', 'COMMIT', 'REVERSE'],
  certificationStatus: 'UNCERTIFIED',
  fixtureEvidence: undefined, // Missing — must fail validateManifest
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

/**
 * Supplier with a failing book fixture — CERTIFIED status claimed but
 * bookOutcome is FAIL. Must fail validateManifest.
 */
export const failingBookFixtureManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_failing_book_fixture_001',
  displayName: 'Supplier With Failing Book Fixture (synthetic)',
  domain: 'ACCOMMODATION',
  sourceClassification: 'MARRIOTT_PARTNERED',
  bookabilityMode: 'FULLY_BOOKABLE',
  availabilityRefreshLatencySeconds: 300,
  rateRefreshLatencySeconds: 120,
  isPriced: true,
  cancellationSemantics: 'FULL_REFUND_72H',
  refundSemantics: 'AUTOMATIC_PLATFORM_REVERSAL',
  supportedOperations: ['QUOTE', 'HOLD', 'COMMIT', 'REVERSE'],
  certificationStatus: 'CERTIFIED',
  fixtureEvidence: {
    fixtureId: 'fix_test_failing_book_001',
    bookOutcome: 'FAIL', // Invalid — book step failed
    cancelOutcome: 'PASS',
    testedAt: '2026-07-01T09:00:00Z',
    testedByAgent: 'fixture-runner-v1',
  },
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

/**
 * Deep-link supplier with checkout operations declared — must fail validateManifest.
 */
export const deepLinkWithCheckoutOpsManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_deep_link_checkout_ops_001',
  displayName: 'Deep-Link Supplier With Checkout Ops (synthetic)',
  domain: 'ACTIVITIES',
  sourceClassification: 'MARRIOTT_PARTNERED',
  bookabilityMode: 'DEEP_LINK_ONLY',
  availabilityRefreshLatencySeconds: 600,
  rateRefreshLatencySeconds: 300,
  isPriced: true,
  cancellationSemantics: 'NOT_APPLICABLE',
  refundSemantics: 'NOT_APPLICABLE',
  supportedOperations: ['QUOTE', 'HOLD', 'DEEP_LINK'], // HOLD is invalid for deep-link
  certificationStatus: 'UNCERTIFIED',
  fixtureEvidence: undefined,
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

/**
 * Priced supplier without rate refresh latency — must fail validateManifest.
 */
export const pricedWithoutRateLatencyManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_priced_no_rate_latency_001',
  displayName: 'Priced Supplier Missing Rate Latency (synthetic)',
  domain: 'ACCOMMODATION',
  sourceClassification: 'MARRIOTT_PARTNERED',
  bookabilityMode: 'FULLY_BOOKABLE',
  availabilityRefreshLatencySeconds: 300,
  rateRefreshLatencySeconds: undefined, // Missing — must fail for priced supplier
  isPriced: true,
  cancellationSemantics: 'FULL_REFUND_72H',
  refundSemantics: 'AUTOMATIC_PLATFORM_REVERSAL',
  supportedOperations: ['QUOTE', 'HOLD', 'COMMIT', 'REVERSE'],
  certificationStatus: 'CERTIFIED',
  fixtureEvidence: {
    fixtureId: 'fix_test_priced_no_rate_latency_001',
    bookOutcome: 'PASS',
    cancelOutcome: 'PASS',
    testedAt: '2026-07-01T09:00:00Z',
    testedByAgent: 'fixture-runner-v1',
  },
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};

/**
 * Public landmark manifest where isPriced is incorrectly set to true.
 * Must fail validateManifest (public landmark cannot be priced).
 */
export const pricedPublicLandmarkManifest: SupplierCapabilityManifest = {
  supplierId: 'sup_test_priced_public_landmark_001',
  displayName: 'Priced Public Landmark — Invalid (synthetic)',
  domain: 'ACTIVITIES',
  sourceClassification: 'EXEMPT_PUBLIC',
  bookabilityMode: 'DEEP_LINK_ONLY',
  availabilityRefreshLatencySeconds: 86400,
  rateRefreshLatencySeconds: 3600,
  isPriced: true, // Invalid for EXEMPT_PUBLIC
  cancellationSemantics: 'NOT_APPLICABLE',
  refundSemantics: 'NOT_APPLICABLE',
  supportedOperations: ['DEEP_LINK'],
  certificationStatus: 'UNCERTIFIED',
  fixtureEvidence: undefined,
  manifestVersion: '1.0.0',
  lastReviewedAt: '2026-07-01T10:00:00Z',
  reviewedBy: 'contract-review-team',
};
