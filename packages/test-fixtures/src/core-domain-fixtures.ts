/**
 * @voya/test-fixtures — Core Domain Fixtures
 *
 * Synthetic test data for the Voya core domain model. These fixtures mirror
 * the Prisma schema shapes and are used in unit and integration tests.
 *
 * IMPORTANT:
 *  - All identifiers are synthetic (prefixed test_).
 *  - No real Bonvoy numbers, passport values, payment card data, or PII.
 *  - ownerRef values are tokenised references, not raw account numbers.
 *  - Supplier certification here is contract-level readiness metadata only;
 *    it does not assert production approval or actual sandbox execution.
 */

import {
  TravellerIdentityType,
  DataClassificationTier,
  PathMode,
  InventoryDomain,
  BookingSource,
  SourceClassification,
  SupplierBookability,
  SupplierCertificationStatus,
  CancellationSemantics,
  RefundSemantics,
  ItineraryStatus,
  ReceiptOutcomePersisted,
  RetentionPurgeAction,
  RetentionApprovalStatus,
} from '@voya/domain-model';

// ---------------------------------------------------------------------------
// Shared type shapes (mirror Prisma model structure without @prisma/client)
// ---------------------------------------------------------------------------

export interface TravellerProfileFixture {
  readonly id: string;
  readonly ownerRef: string;
  readonly identityType: TravellerIdentityType;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TravellerSessionFixture {
  readonly id: string;
  readonly travellerProfileId: string;
  readonly pathMode: PathMode;
  readonly expiresAt: Date;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TripIntentFixture {
  readonly id: string;
  readonly travellerProfileId: string;
  readonly sessionId: string | null;
  readonly pathMode: PathMode;
  readonly rawConstraintsJson: Record<string, unknown>;
  readonly destinationToken: string;
  readonly checkInDate: Date;
  readonly checkOutDate: Date;
  readonly partySize: number;
  readonly budgetBandCode: string | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ItineraryFixture {
  readonly id: string;
  readonly travellerProfileId: string;
  readonly tripIntentId: string;
  readonly version: number;
  readonly status: ItineraryStatus;
  readonly pathMode: PathMode;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SourceProvenanceFixture {
  readonly id: string;
  readonly supplierId: string;
  readonly sourceRef: string;
  readonly bookingSource: BookingSource;
  readonly sourceClassification: SourceClassification;
  readonly fetchedAt: Date;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
}

export interface ItineraryLineItemFixture {
  readonly id: string;
  readonly itineraryId: string;
  readonly itineraryDayId: string | null;
  readonly sourceProvenanceId: string;
  readonly domain: InventoryDomain;
  readonly supplierRef: string;
  readonly displayNameSnapshot: string;
  readonly priceAmountMinorUnits: number | null;
  readonly priceCurrencyCode: string | null;
  readonly pointsAmount: number | null;
  readonly availabilityDataAgeSeconds: number | null;
  readonly rateDataAgeSeconds: number | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TripConfidenceReceiptFixture {
  readonly id: string;
  readonly itineraryId: string;
  readonly itineraryVersion: number;
  readonly outcome: ReceiptOutcomePersisted;
  readonly feasibilityPassed: boolean;
  readonly freshnessGrade: 'FRESH' | 'STALE' | 'UNRATABLE';
  readonly blockedReasonCode: string | null;
  readonly evaluatedAt: Date;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
}

export interface SupplierCapabilityManifestFixture {
  readonly id: string;
  readonly supplierId: string;
  readonly displayName: string;
  readonly domain: InventoryDomain;
  readonly sourceClassification: SourceClassification;
  readonly bookabilityMode: SupplierBookability;
  readonly availabilityRefreshLatencySeconds: number;
  readonly rateRefreshLatencySeconds: number | null;
  readonly isPriced: boolean;
  readonly cancellationSemantics: CancellationSemantics;
  readonly refundSemantics: RefundSemantics;
  readonly certificationStatus: SupplierCertificationStatus;
  readonly fixtureEvidenceRef: string | null;
  readonly manifestVersion: string;
  readonly lastReviewedAt: Date;
  readonly reviewedBy: string;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RetentionPolicyMetadataFixture {
  readonly id: string;
  readonly policyKey: string;
  readonly targetTable: string;
  readonly targetColumn: string | null;
  readonly triggerEvent: string;
  readonly retentionDays: number;
  readonly purgeAction: RetentionPurgeAction;
  readonly approvalStatus: RetentionApprovalStatus;
  readonly notes: string | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Fixture: minimal traveller profile (guest session — no Bonvoy authentication)
// ---------------------------------------------------------------------------

export const testGuestTravellerProfile: TravellerProfileFixture = {
  id: 'tp_test_guest_001',
  ownerRef: 'tok_test_guest_session_a1b2c3d4',   // tokenised guest ref, not a real ID
  identityType: TravellerIdentityType.GUEST_TOKEN,
  dataClassification: DataClassificationTier.CONFIDENTIAL,
  createdAt: new Date('2026-07-01T08:00:00Z'),
  updatedAt: new Date('2026-07-01T08:00:00Z'),
};

export const testBonvoyTravellerProfile: TravellerProfileFixture = {
  id: 'tp_test_bonvoy_member_001',
  ownerRef: 'tok_test_bonvoy_member_e5f6g7h8',   // tokenised Bonvoy ref, NOT a Bonvoy account number
  identityType: TravellerIdentityType.BONVOY_AUTHENTICATED,
  dataClassification: DataClassificationTier.CONFIDENTIAL,
  createdAt: new Date('2026-07-01T09:00:00Z'),
  updatedAt: new Date('2026-07-01T09:00:00Z'),
};

// ---------------------------------------------------------------------------
// Fixture: traveller session
// ---------------------------------------------------------------------------

export const testTravellerSession: TravellerSessionFixture = {
  id: 'ts_test_session_001',
  travellerProfileId: testGuestTravellerProfile.id,
  pathMode: PathMode.PATH_B,
  expiresAt: new Date('2026-07-01T20:00:00Z'),
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:00:00Z'),
  updatedAt: new Date('2026-07-01T08:00:00Z'),
};

// ---------------------------------------------------------------------------
// Fixture: trip intent
// ---------------------------------------------------------------------------

export const testTripIntent: TripIntentFixture = {
  id: 'ti_test_trip_intent_001',
  travellerProfileId: testGuestTravellerProfile.id,
  sessionId: testTravellerSession.id,
  pathMode: PathMode.PATH_B,
  rawConstraintsJson: {
    destinationToken: 'dest_test_coastal_tuscany_001',
    checkIn: '2026-09-01',
    checkOut: '2026-09-08',
    partySize: 2,
    budgetBandCode: 'MID',
    interestTags: ['beach', 'wine'],
  },
  destinationToken: 'dest_test_coastal_tuscany_001',
  checkInDate: new Date('2026-09-01'),
  checkOutDate: new Date('2026-09-08'),
  partySize: 2,
  budgetBandCode: 'MID',
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:05:00Z'),
  updatedAt: new Date('2026-07-01T08:05:00Z'),
};

// ---------------------------------------------------------------------------
// Fixture: itinerary
// ---------------------------------------------------------------------------

export const testItinerary: ItineraryFixture = {
  id: 'itin_test_coastal_tuscany_001',
  travellerProfileId: testGuestTravellerProfile.id,
  tripIntentId: testTripIntent.id,
  version: 1,
  status: ItineraryStatus.VERIFIED,
  pathMode: PathMode.PATH_B,
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:10:00Z'),
  updatedAt: new Date('2026-07-01T08:15:00Z'),
};

// ---------------------------------------------------------------------------
// Fixtures: source provenance records
// ---------------------------------------------------------------------------

export const testHvmiSourceProvenance: SourceProvenanceFixture = {
  id: 'sp_test_hvmi_accom_001',
  supplierId: 'sup_test_hvmi_accommodation_001',
  sourceRef: 'hvmi_ref_test_villa_coastal_001',
  bookingSource: BookingSource.HVMI,
  sourceClassification: SourceClassification.MARRIOTT_PARTNERED,
  fetchedAt: new Date('2026-07-01T08:08:00Z'),
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:08:00Z'),
};

export const testAmadeusSourceProvenance: SourceProvenanceFixture = {
  id: 'sp_test_amadeus_flight_001',
  supplierId: 'sup_test_amadeus_gds_flights_001',
  sourceRef: 'amadeus_ref_test_flight_fco_jfk_001',
  bookingSource: BookingSource.AMADEUS_GDS,
  sourceClassification: SourceClassification.MARRIOTT_PARTNERED,
  fetchedAt: new Date('2026-07-01T08:08:30Z'),
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:08:30Z'),
};

// ---------------------------------------------------------------------------
// Fixtures: itinerary line items
// ---------------------------------------------------------------------------

export const testAccommodationLineItem: ItineraryLineItemFixture = {
  id: 'li_test_hvmi_accom_001',
  itineraryId: testItinerary.id,
  itineraryDayId: null,
  sourceProvenanceId: testHvmiSourceProvenance.id,
  domain: InventoryDomain.ACCOMMODATION,
  supplierRef: 'hvmi_ref_test_villa_coastal_001',
  displayNameSnapshot: 'Coastal Tuscan Villa — synthetic test fixture',
  priceAmountMinorUnits: 42000,         // USD 420.00 per night (synthetic)
  priceCurrencyCode: 'USD',
  pointsAmount: null,
  availabilityDataAgeSeconds: 120,
  rateDataAgeSeconds: 60,
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:10:00Z'),
  updatedAt: new Date('2026-07-01T08:10:00Z'),
};

export const testFlightLineItem: ItineraryLineItemFixture = {
  id: 'li_test_amadeus_flight_001',
  itineraryId: testItinerary.id,
  itineraryDayId: null,
  sourceProvenanceId: testAmadeusSourceProvenance.id,
  domain: InventoryDomain.FLIGHTS,
  supplierRef: 'amadeus_ref_test_flight_fco_jfk_001',
  displayNameSnapshot: 'FCO → JFK — synthetic test fixture',
  priceAmountMinorUnits: 89900,         // USD 899.00 (synthetic)
  priceCurrencyCode: 'USD',
  pointsAmount: null,
  availabilityDataAgeSeconds: 30,
  rateDataAgeSeconds: 30,
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:10:00Z'),
  updatedAt: new Date('2026-07-01T08:10:00Z'),
};

// ---------------------------------------------------------------------------
// Fixtures: Trip Confidence Receipts
// ---------------------------------------------------------------------------

export const testPassingReceipt: TripConfidenceReceiptFixture = {
  id: 'tcr_test_passing_001',
  itineraryId: testItinerary.id,
  itineraryVersion: 1,
  outcome: ReceiptOutcomePersisted.PASS,
  feasibilityPassed: true,
  freshnessGrade: 'FRESH',
  blockedReasonCode: null,
  evaluatedAt: new Date('2026-07-01T08:15:00Z'),
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:15:00Z'),
};

export const testFailingReceipt: TripConfidenceReceiptFixture = {
  id: 'tcr_test_failing_001',
  itineraryId: testItinerary.id,
  itineraryVersion: 1,
  outcome: ReceiptOutcomePersisted.FAIL,
  feasibilityPassed: false,
  freshnessGrade: 'STALE',
  blockedReasonCode: 'AVAILABILITY_FAILED',
  evaluatedAt: new Date('2026-07-01T08:16:00Z'),
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:16:00Z'),
};

export const testBlockedReceipt: TripConfidenceReceiptFixture = {
  id: 'tcr_test_blocked_001',
  itineraryId: testItinerary.id,
  itineraryVersion: 1,
  outcome: ReceiptOutcomePersisted.BLOCKED,
  feasibilityPassed: false,
  freshnessGrade: 'UNRATABLE',
  blockedReasonCode: 'SUPPLIER_UNCERTIFIED',
  evaluatedAt: new Date('2026-07-01T08:17:00Z'),
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T08:17:00Z'),
};

// ---------------------------------------------------------------------------
// Fixtures: supplier capability manifests
// ---------------------------------------------------------------------------

export const testHvmiManifestRow: SupplierCapabilityManifestFixture = {
  id: 'scm_test_hvmi_001',
  supplierId: 'sup_test_hvmi_accommodation_001',
  displayName: 'Homes and Villas by Marriott Bonvoy (synthetic)',
  domain: InventoryDomain.ACCOMMODATION,
  sourceClassification: SourceClassification.MARRIOTT_PARTNERED,
  bookabilityMode: SupplierBookability.FULLY_BOOKABLE,
  availabilityRefreshLatencySeconds: 300,
  rateRefreshLatencySeconds: 120,
  isPriced: true,
  cancellationSemantics: CancellationSemantics.FULL_REFUND_72H,
  refundSemantics: RefundSemantics.AUTOMATIC_PLATFORM_REVERSAL,
  certificationStatus: SupplierCertificationStatus.CERTIFIED,
  fixtureEvidenceRef: 'fix_test_hvmi_book_cancel_001',
  manifestVersion: '1.0.0',
  lastReviewedAt: new Date('2026-07-01T10:00:00Z'),
  reviewedBy: 'contract-review-team',
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T10:00:00Z'),
  updatedAt: new Date('2026-07-01T10:00:00Z'),
};

export const testBrandManifestRow: SupplierCapabilityManifestFixture = {
  id: 'scm_test_brand_001',
  supplierId: 'sup_test_marriott_brand_accommodation_001',
  displayName: 'Marriott Brand Direct (synthetic)',
  domain: InventoryDomain.ACCOMMODATION,
  sourceClassification: SourceClassification.MARRIOTT_OWNED,
  bookabilityMode: SupplierBookability.FULLY_BOOKABLE,
  availabilityRefreshLatencySeconds: 300,
  rateRefreshLatencySeconds: 120,
  isPriced: true,
  cancellationSemantics: CancellationSemantics.FULL_REFUND_24H,
  refundSemantics: RefundSemantics.AUTOMATIC_PLATFORM_REVERSAL,
  certificationStatus: SupplierCertificationStatus.CERTIFIED,
  fixtureEvidenceRef: 'fix_test_brand_book_cancel_001',
  manifestVersion: '1.0.0',
  lastReviewedAt: new Date('2026-07-01T10:00:00Z'),
  reviewedBy: 'contract-review-team',
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T10:00:00Z'),
  updatedAt: new Date('2026-07-01T10:00:00Z'),
};

// ---------------------------------------------------------------------------
// Fixtures: retention policy metadata
// ---------------------------------------------------------------------------

export const testSessionRetentionPolicy: RetentionPolicyMetadataFixture = {
  id: 'rpm_test_session_001',
  policyKey: 'traveller_session_data',
  targetTable: 'traveller_session',
  targetColumn: null,
  triggerEvent: 'SESSION_EXPIRED',
  retentionDays: 30,
  purgeAction: RetentionPurgeAction.DELETE,
  approvalStatus: RetentionApprovalStatus.PROVISIONAL,
  notes: 'Synthetic fixture. Pending legal/privacy review.',
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T10:00:00Z'),
  updatedAt: new Date('2026-07-01T10:00:00Z'),
};

export const testAuditRetentionPolicy: RetentionPolicyMetadataFixture = {
  id: 'rpm_test_audit_001',
  policyKey: 'audit_record_data',
  targetTable: 'audit_record',
  targetColumn: null,
  triggerEvent: 'BOOKING_CONFIRMED',
  retentionDays: 2555,  // 7 years — typical financial audit retention
  purgeAction: RetentionPurgeAction.ARCHIVE,
  approvalStatus: RetentionApprovalStatus.PROVISIONAL,
  notes: 'Synthetic fixture. Pending compliance review.',
  dataClassification: DataClassificationTier.INTERNAL,
  createdAt: new Date('2026-07-01T10:00:00Z'),
  updatedAt: new Date('2026-07-01T10:00:00Z'),
};
