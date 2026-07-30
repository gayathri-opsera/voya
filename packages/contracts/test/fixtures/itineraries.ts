/**
 * Deterministic itinerary fixtures for contract testing.
 *
 * Covers:
 *   - valid HVMI-first itinerary (accommodation + dining + activity)
 *   - brand-fallback itinerary with disclosure
 *   - stale receipt (freshness window exceeded)
 *   - hallucinated inventory attempt (must fail validation)
 *   - public landmark exemption case
 *   - Amadeus flight exemption case
 *
 * NO live supplier calls. All timestamps are fixed in the past to avoid
 * non-determinism. Do NOT use Date.now() or Math.random() here.
 */

import {
  ApprovedExemptionType,
  BudgetBand,
  InventoryDomain,
  PricingUnit,
  ReceiptOutcome,
  SourceClassification,
} from '../../src/common/enums.js';
import type {
  ItineraryLineItem,
  TripConfidenceReceipt,
  TripConstraints,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Shared timestamps
// ---------------------------------------------------------------------------

/** Fixed base time — all timestamps derive from this anchor. */
const BASE = '2025-09-15T10:00:00.000Z';
const CHECK_IN = '2025-09-20T15:00:00.000Z';
const CHECK_OUT = '2025-09-25T11:00:00.000Z';
const AVAIL_CHECKED = '2025-09-15T09:50:00.000Z';
const PRICE_FRESH = '2025-09-15T09:55:00.000Z';
const RECEIPT_GEN = '2025-09-15T10:00:00.000Z';
const RECEIPT_DEADLINE = '2025-09-15T10:30:00.000Z';

// ---------------------------------------------------------------------------
// TripConstraints fixtures
// ---------------------------------------------------------------------------

/**
 * Valid HVMI-first trip constraints.
 * travellerRef is an opaque token — no PII.
 */
export const validTripConstraints: TripConstraints = {
  travellerRef: 'tok_traveller_abc123',
  destination: {
    name: 'Maui, Hawaii',
    countryCode: 'US',
    regionCode: 'HI',
    coordinates: { latitude: 20.7984, longitude: -156.3319 },
  },
  dateWindow: { checkIn: CHECK_IN, checkOut: CHECK_OUT },
  partyComposition: { adults: 2, children: 1, infants: 0, pets: 0 },
  budgetBand: BudgetBand.LUXURY,
  interestTags: ['beachfront', 'pool', 'family-friendly'],
  accessibilityNeeds: [],
};

/**
 * Valid constraints with empty interest tags (decisive search flow).
 */
export const validConstraintsEmptyTags: TripConstraints = {
  travellerRef: 'tok_traveller_def456',
  destination: { name: 'Paris, France', countryCode: 'FR' },
  dateWindow: { checkIn: CHECK_IN, checkOut: CHECK_OUT },
  partyComposition: { adults: 2, children: 0, infants: 0, pets: 0 },
  budgetBand: BudgetBand.PREMIUM,
  interestTags: [],
};

/**
 * INVALID — contains prohibited personal data fields.
 * Must fail TripConstraintsSchema validation.
 */
export const invalidConstraintsWithPii = {
  travellerRef: 'tok_traveller_ghi789',
  name: 'Alice Traveller', // ← PROHIBITED
  email: 'alice@example.com', // ← PROHIBITED
  bonvoyNumber: '12345678', // ← PROHIBITED
  destination: { name: 'Tokyo, Japan', countryCode: 'JP' },
  dateWindow: { checkIn: CHECK_IN, checkOut: CHECK_OUT },
  partyComposition: { adults: 1, children: 0, infants: 0, pets: 0 },
  budgetBand: BudgetBand.MODERATE,
  interestTags: [],
};

/**
 * INVALID — missing required dates.
 */
export const invalidConstraintsMissingDates = {
  travellerRef: 'tok_traveller_jkl012',
  destination: { name: 'Barcelona, Spain', countryCode: 'ES' },
  // dateWindow omitted intentionally
  partyComposition: { adults: 2, children: 0, infants: 0, pets: 0 },
  budgetBand: BudgetBand.MODERATE,
  interestTags: [],
};

/**
 * INVALID — party composition has zero adults.
 */
export const invalidConstraintsZeroAdults = {
  travellerRef: 'tok_traveller_mno345',
  destination: { name: 'Sydney, Australia', countryCode: 'AU' },
  dateWindow: { checkIn: CHECK_IN, checkOut: CHECK_OUT },
  partyComposition: { adults: 0, children: 2, infants: 0, pets: 0 }, // ← INVALID
  budgetBand: BudgetBand.ECONOMY,
  interestTags: [],
};

// ---------------------------------------------------------------------------
// ItineraryLineItem fixtures
// ---------------------------------------------------------------------------

/**
 * Valid HVMI-first accommodation line item.
 */
export const hvmiAccommodationLineItem: ItineraryLineItem = {
  id: 'item_hvmi_accom_001',
  name: 'Oceanfront Villa – Homes & Villas by Marriott Bonvoy',
  description: 'Private 4BR oceanfront villa with pool, Maui',
  inventoryDomain: InventoryDomain.ACCOMMODATION,
  supplierReference: 'hvmi-property-mau-4001',
  sourceClassification: SourceClassification.MARRIOTT_OWNED,
  sourceRecordIdentifier: 'HVMI-MAU-4001',
  provenanceLabel: 'Marriott Homes & Villas',
  availabilityCheckedAt: AVAIL_CHECKED,
  pricing: {
    amount: 1250.0,
    currency: 'USD',
    unit: PricingUnit.PER_NIGHT,
    isEstimate: false,
    priceFreshnessAt: PRICE_FRESH,
  },
  travellerVisibleSourceTag: 'Homes & Villas by Marriott Bonvoy',
  startAt: CHECK_IN,
  endAt: CHECK_OUT,
};

/**
 * Valid brand-fallback accommodation (Marriott-partnered, disclosure required).
 */
export const brandFallbackAccommodationLineItem: ItineraryLineItem = {
  id: 'item_brand_accom_002',
  name: 'The Westin Maui Resort & Spa',
  inventoryDomain: InventoryDomain.ACCOMMODATION,
  supplierReference: 'brand-property-westin-mau-101',
  sourceClassification: SourceClassification.MARRIOTT_PARTNERED,
  sourceRecordIdentifier: 'WESTIN-MAU-101',
  provenanceLabel: 'Marriott Brand Properties',
  availabilityCheckedAt: AVAIL_CHECKED,
  pricing: {
    amount: 650.0,
    currency: 'USD',
    unit: PricingUnit.PER_NIGHT,
    isEstimate: false,
    priceFreshnessAt: PRICE_FRESH,
  },
  travellerVisibleSourceTag: 'Marriott Bonvoy Hotels',
  startAt: CHECK_IN,
  endAt: CHECK_OUT,
};

/**
 * Valid dining line item (Marriott-partnered restaurant).
 */
export const diningLineItem: ItineraryLineItem = {
  id: 'item_dining_003',
  name: 'Spago Maui – Fine Dining',
  inventoryDomain: InventoryDomain.DINING,
  supplierReference: 'bonvoy-ta-dining-spago-mau',
  sourceClassification: SourceClassification.MARRIOTT_PARTNERED,
  sourceRecordIdentifier: 'BONTA-DINING-SPAGO-MAU',
  provenanceLabel: 'Bonvoy Tours & Activities',
  availabilityCheckedAt: AVAIL_CHECKED,
  pricing: {
    amount: 120.0,
    currency: 'USD',
    unit: PricingUnit.PER_PERSON,
    isEstimate: true,
    priceFreshnessAt: PRICE_FRESH,
  },
  travellerVisibleSourceTag: 'Marriott Bonvoy Experiences',
  startAt: '2025-09-21T19:00:00.000Z',
};

/**
 * Valid activity line item (Marriott-owned experience).
 */
export const activityLineItem: ItineraryLineItem = {
  id: 'item_activity_004',
  name: 'Snorkelling at Molokini Crater – Guided Tour',
  inventoryDomain: InventoryDomain.ACTIVITY,
  supplierReference: 'bonvoy-ta-activity-molokini-001',
  sourceClassification: SourceClassification.MARRIOTT_OWNED,
  sourceRecordIdentifier: 'BONTA-ACTIVITY-MOLOKINI-001',
  provenanceLabel: 'Marriott Homes & Villas Experiences',
  availabilityCheckedAt: AVAIL_CHECKED,
  pricing: {
    amount: 95.0,
    currency: 'USD',
    unit: PricingUnit.PER_PERSON,
    isEstimate: false,
    priceFreshnessAt: PRICE_FRESH,
  },
  travellerVisibleSourceTag: 'Homes & Villas by Marriott Bonvoy',
  startAt: '2025-09-22T08:00:00.000Z',
  endAt: '2025-09-22T12:00:00.000Z',
};

/**
 * Valid flight line item via Amadeus GDS exemption.
 */
export const amadeusFlightLineItem: ItineraryLineItem = {
  id: 'item_flight_005',
  name: 'American Airlines AA198 — Los Angeles to Kahului',
  inventoryDomain: InventoryDomain.FLIGHT,
  supplierReference: 'amadeus-seg-AA198-LAX-OGG',
  sourceClassification: SourceClassification.AMADEUS_FLIGHT,
  approvedExemption: {
    type: ApprovedExemptionType.AMADEUS_FLIGHT,
    amadeusFlightRef: 'AA198-20250920-LAX-OGG',
  },
  provenanceLabel: 'Amadeus GDS',
  availabilityCheckedAt: AVAIL_CHECKED,
  pricing: {
    amount: 420.0,
    currency: 'USD',
    unit: PricingUnit.PER_PERSON,
    isEstimate: false,
    priceFreshnessAt: PRICE_FRESH,
  },
  travellerVisibleSourceTag: 'Amadeus',
  startAt: '2025-09-20T08:00:00.000Z',
  endAt: '2025-09-20T11:30:00.000Z',
};

/**
 * Valid public landmark line item (Haleakalā National Park).
 * No pricing — landmarks are non-bookable.
 * Uses public-landmark exemption so sourceRecordIdentifier is optional.
 */
export const publicLandmarkLineItem: ItineraryLineItem = {
  id: 'item_landmark_006',
  name: 'Haleakalā National Park — Sunrise Viewing',
  description: 'Watch the sunrise from the summit of Haleakalā volcano (10,023 ft)',
  inventoryDomain: InventoryDomain.LANDMARK,
  supplierReference: 'nps-landmark-haleakala',
  sourceClassification: SourceClassification.PUBLIC_LANDMARK,
  approvedExemption: {
    type: ApprovedExemptionType.PUBLIC_LANDMARK,
    landmarkName: 'Haleakalā National Park',
    landmarkId: 'NPS-HALE',
  },
  provenanceLabel: 'National Park Service (public landmark)',
  availabilityCheckedAt: AVAIL_CHECKED,
  travellerVisibleSourceTag: 'Public Landmark',
  startAt: '2025-09-21T05:00:00.000Z',
  endAt: '2025-09-21T08:00:00.000Z',
};

/**
 * INVALID accommodation — non-Marriott source classification.
 * Must fail: accommodation must be marriott-owned or marriott-partnered.
 */
export const invalidAccommodationWrongSource: Omit<
  ItineraryLineItem,
  'sourceClassification'
> & { sourceClassification: string } = {
  id: 'item_hallucinated_accom',
  name: 'Random Non-Marriott Hotel',
  inventoryDomain: InventoryDomain.ACCOMMODATION,
  supplierReference: 'third-party-hotel-xyz',
  sourceClassification: SourceClassification.AMADEUS_FLIGHT, // ← INVALID for accommodation
  sourceRecordIdentifier: 'THIRDPARTY-XYZ-001',
  provenanceLabel: 'Unknown Supplier',
  availabilityCheckedAt: AVAIL_CHECKED,
  pricing: {
    amount: 200.0,
    currency: 'USD',
    unit: PricingUnit.PER_NIGHT,
    isEstimate: true,
    priceFreshnessAt: PRICE_FRESH,
  },
  travellerVisibleSourceTag: 'Third Party',
};

/**
 * INVALID — hallucinated accommodation with no source record or exemption.
 * Must fail: no provenance means no inventory truth.
 */
export const invalidHallucinatedInventory = {
  id: 'item_hallucinated_no_source',
  name: 'Imaginary Beach Resort (LLM-generated)',
  inventoryDomain: InventoryDomain.ACCOMMODATION,
  supplierReference: 'llm-hallucination-supplier',
  sourceClassification: SourceClassification.MARRIOTT_OWNED,
  // sourceRecordIdentifier omitted
  // approvedExemption omitted
  provenanceLabel: 'Hallucinated',
  availabilityCheckedAt: AVAIL_CHECKED,
  pricing: {
    amount: 500.0,
    currency: 'USD',
    unit: PricingUnit.PER_NIGHT,
    isEstimate: false,
    priceFreshnessAt: PRICE_FRESH,
  },
  travellerVisibleSourceTag: 'Unknown',
};

// ---------------------------------------------------------------------------
// TripConfidenceReceipt fixtures
// ---------------------------------------------------------------------------

/**
 * Reusable feasibility summary for a valid itinerary.
 */
const passingFeasibility = {
  isExecutable: true,
  checkedAt: BASE,
  hardConstraintViolations: [],
  openingHoursVerified: true,
  travelTimeVerified: true,
  loadBalanceVerified: true,
  gapNightsResolved: true,
  availabilityConfirmed: true,
};

/**
 * Reusable provenance summary for HVMI-first itinerary.
 */
const hvmiFirstProvenance = {
  totalLineItems: 4,
  marriottOwnedCount: 2,
  marriottPartneredCount: 1,
  exemptCount: 1,
  allSourcesResolved: true,
  hvmiFirstSatisfied: true,
  fallbackDisclosureRequired: false,
};

/**
 * Reusable freshness summary for data all within window.
 */
const freshnessPassing = {
  oldestDataAt: AVAIL_CHECKED,
  newestDataAt: PRICE_FRESH,
  staleDomains: [],
  allWithinFreshnessWindow: true,
};

/**
 * Valid PASS receipt — HVMI-first itinerary, all checks pass.
 */
export const validPassReceipt: TripConfidenceReceipt = {
  receiptId: 'rcpt_hvmi_pass_001',
  itineraryId: 'itin_maui_2025_001',
  outcome: ReceiptOutcome.PASS,
  feasibilitySummary: passingFeasibility,
  provenanceSummary: hvmiFirstProvenance,
  freshnessSummary: freshnessPassing,
  blockingReasons: [],
  generatedAt: RECEIPT_GEN,
  receiptValidityDeadline: RECEIPT_DEADLINE,
};

/**
 * Valid PASS receipt — brand-fallback itinerary with disclosure required.
 */
export const validBrandFallbackPassReceipt: TripConfidenceReceipt = {
  receiptId: 'rcpt_brand_fallback_002',
  itineraryId: 'itin_maui_fallback_2025',
  outcome: ReceiptOutcome.PASS,
  feasibilitySummary: passingFeasibility,
  provenanceSummary: {
    totalLineItems: 3,
    marriottOwnedCount: 0,
    marriottPartneredCount: 2,
    exemptCount: 1,
    allSourcesResolved: true,
    hvmiFirstSatisfied: false, // brand fallback used
    fallbackDisclosureRequired: true, // ← disclosure must render
  },
  freshnessSummary: freshnessPassing,
  blockingReasons: [],
  generatedAt: RECEIPT_GEN,
  receiptValidityDeadline: RECEIPT_DEADLINE,
};

/**
 * STALE receipt — accommodation freshness window exceeded.
 * Must block presentation until re-verified.
 */
export const staleReceipt: TripConfidenceReceipt = {
  receiptId: 'rcpt_stale_003',
  itineraryId: 'itin_maui_stale_2025',
  outcome: ReceiptOutcome.STALE,
  feasibilitySummary: {
    ...passingFeasibility,
    availabilityConfirmed: false,
  },
  provenanceSummary: hvmiFirstProvenance,
  freshnessSummary: {
    oldestDataAt: '2025-09-13T06:00:00.000Z',
    newestDataAt: '2025-09-13T06:30:00.000Z',
    staleDomains: ['accommodation'],
    allWithinFreshnessWindow: false,
  },
  blockingReasons: [
    {
      code: 'FRESHNESS_EXPIRED',
      fieldPath: 'lineItems[0].availabilityCheckedAt',
      rule: 'availability-data-must-be-within-freshness-window',
      detail: 'Accommodation availability data is older than the 24h freshness window',
      lineItemId: 'item_hvmi_accom_001',
    },
  ],
  generatedAt: RECEIPT_GEN,
  receiptValidityDeadline: RECEIPT_DEADLINE,
};

/**
 * BLOCKED receipt — hallucinated inventory provenance failure.
 * Represents what the receipt generator emits when an item lacks Marriott provenance.
 */
export const blockedHallucinatedInventoryReceipt: TripConfidenceReceipt = {
  receiptId: 'rcpt_blocked_hallucination_004',
  itineraryId: 'itin_hallucinated_2025',
  outcome: ReceiptOutcome.BLOCKED,
  feasibilitySummary: {
    ...passingFeasibility,
    isExecutable: false,
    hardConstraintViolations: ['provenance-check-failed'],
  },
  provenanceSummary: {
    totalLineItems: 2,
    marriottOwnedCount: 0,
    marriottPartneredCount: 0,
    exemptCount: 0,
    allSourcesResolved: false,
    hvmiFirstSatisfied: false,
    fallbackDisclosureRequired: false,
  },
  freshnessSummary: {
    oldestDataAt: AVAIL_CHECKED,
    newestDataAt: PRICE_FRESH,
    staleDomains: [],
    allWithinFreshnessWindow: true,
  },
  blockingReasons: [
    {
      code: 'PROVENANCE_MISSING',
      fieldPath: 'lineItems[0].sourceRecordIdentifier',
      rule: 'every-line-item-must-have-provenance-or-approved-exemption',
      detail: 'Accommodation line item has no Marriott source record and no approved exemption',
      lineItemId: 'item_hallucinated_no_source',
    },
  ],
  generatedAt: RECEIPT_GEN,
  receiptValidityDeadline: RECEIPT_DEADLINE,
};

/**
 * INVALID receipt — generatedAt is BEFORE freshnessSummary.newestDataAt.
 * Must fail TripConfidenceReceiptSchema validation.
 * A receipt cannot certify data it did not evaluate.
 */
export const invalidReceiptGeneratedBeforeData = {
  receiptId: 'rcpt_invalid_timing_005',
  itineraryId: 'itin_timing_error_2025',
  outcome: ReceiptOutcome.PASS,
  feasibilitySummary: passingFeasibility,
  provenanceSummary: hvmiFirstProvenance,
  freshnessSummary: {
    oldestDataAt: '2025-09-15T09:00:00.000Z',
    newestDataAt: '2025-09-15T11:00:00.000Z', // ← AFTER generatedAt
    staleDomains: [],
    allWithinFreshnessWindow: true,
  },
  blockingReasons: [],
  generatedAt: '2025-09-15T10:00:00.000Z', // ← BEFORE newestDataAt
  receiptValidityDeadline: '2025-09-15T10:30:00.000Z',
};

/**
 * INVALID receipt — BLOCKED outcome with no blocking reasons.
 * Must fail validation: blocked receipts must carry machine-readable reasons.
 */
export const invalidBlockedReceiptNoReasons = {
  receiptId: 'rcpt_invalid_blocked_no_reasons_006',
  itineraryId: 'itin_blocked_empty_reasons',
  outcome: ReceiptOutcome.BLOCKED,
  feasibilitySummary: {
    ...passingFeasibility,
    isExecutable: false,
  },
  provenanceSummary: hvmiFirstProvenance,
  freshnessSummary: freshnessPassing,
  blockingReasons: [], // ← INVALID: blocked must have reasons
  generatedAt: RECEIPT_GEN,
  receiptValidityDeadline: RECEIPT_DEADLINE,
};
