/**
 * @voya/domain-repositories — Repository test fixtures
 *
 * All identifiers are synthetic. No real Bonvoy numbers, emails, or PII.
 * These fixtures model the cross-cutting scenarios that repository unit tests
 * must cover: owned access, cross-owner access, version history, and audit appends.
 */

import {
  TravellerIdentityType,
  DataClassificationTier,
  PathMode,
  InventoryDomain,
  BookingSource,
  SourceClassification,
  ItineraryStatus,
} from '@voya/domain-model';
import type { CreateTravellerProfileInput } from '../../src/interfaces/traveller-profile-repository.js';
import type { CreateItineraryInput } from '../../src/interfaces/itinerary-repository.js';
import type { AppendReceiptInput } from '../../src/interfaces/trip-confidence-receipt-repository.js';
import type { AppendAuditRecordInput, AppendLedgerEntryInput } from '../../src/interfaces/audit-record-repository.js';

// ---------------------------------------------------------------------------
// Owner references — two distinct synthetic travellers
// ---------------------------------------------------------------------------

export const OWNER_A_REF = 'tok_test_owner_a_001';
export const OWNER_B_REF = 'tok_test_owner_b_001';

// ---------------------------------------------------------------------------
// Traveller profile inputs
// ---------------------------------------------------------------------------

export const ownerAProfileInput: CreateTravellerProfileInput = {
  ownerRef:           OWNER_A_REF,
  identityType:       TravellerIdentityType.BONVOY_AUTHENTICATED,
  dataClassification: DataClassificationTier.CONFIDENTIAL,
};

export const ownerBProfileInput: CreateTravellerProfileInput = {
  ownerRef:     OWNER_B_REF,
  identityType: TravellerIdentityType.GUEST_TOKEN,
};

// ---------------------------------------------------------------------------
// Itinerary inputs — owned by owner A
// ---------------------------------------------------------------------------

export function makeOwnedItineraryInput(
  travellerProfileId: string,
  tripIntentId: string,
): CreateItineraryInput {
  return {
    travellerProfileId,
    ownerRef: OWNER_A_REF,
    tripIntentId,
    pathMode: PathMode.PATH_A,
    days: [
      {
        dayIndex: 0,
        date:     new Date('2026-07-01'),
        lineItems: [
          {
            sourceProvenance: {
              supplierId:           'sup_test_hvmi_001',
              sourceRef:            'hvmi_test_ref_001',
              bookingSource:        BookingSource.HVMI,
              sourceClassification: SourceClassification.MARRIOTT_PARTNERED,
              fetchedAt:            new Date('2026-06-30T10:00:00.000Z'),
            },
            domain:               InventoryDomain.ACCOMMODATION,
            supplierRef:          'prop_test_001',
            displayNameSnapshot:  'Test Villa (synthetic)',
            priceAmountMinorUnits: 25000,
            priceCurrencyCode:    'USD',
            availabilityDataAgeSeconds: 120,
            rateDataAgeSeconds:         60,
          },
        ],
      },
    ],
  };
}

/** Input that identifies a cross-owner access attempt (owner B's ref used against owner A's itinerary) */
export const crossOwnerAccessRef = OWNER_B_REF;

// ---------------------------------------------------------------------------
// Receipt inputs
// ---------------------------------------------------------------------------

export function makePassingReceiptInput(
  itineraryId: string,
  lineItemId: string,
): AppendReceiptInput {
  return {
    itineraryId,
    itineraryVersion:  1,
    outcome:           'PASS',
    feasibilityPassed: true,
    freshnessGrade:    'FRESH',
    evaluatedAt:       new Date('2026-06-30T10:05:00.000Z'),
    lineItems: [
      {
        lineItemId,
        freshnessGrade:       'FRESH',
        isAvailabilityStale:  false,
        isRateStale:          false,
      },
    ],
  };
}

export function makeBlockedReceiptInput(
  itineraryId: string,
): AppendReceiptInput {
  return {
    itineraryId,
    itineraryVersion:  2,
    outcome:           'BLOCKED',
    feasibilityPassed: false,
    freshnessGrade:    'STALE',
    blockedReasonCode: 'PRICE_CHANGED',
    evaluatedAt:       new Date('2026-06-30T12:00:00.000Z'),
    lineItems:         [],
  };
}

// ---------------------------------------------------------------------------
// Audit inputs
// ---------------------------------------------------------------------------

export const sourcingOrderAuditInput: AppendAuditRecordInput = {
  eventType:   'SOURCING_ORDER',
  sessionRef:  'sess_test_001',
  payloadJson: {
    connectorOrder:  ['HVMI', 'MARRIOTT_BRAND'],
    destinationToken: 'dest_test_paris_001',
  },
  pathMode:           PathMode.PATH_A,
  dataClassification: DataClassificationTier.INTERNAL,
};

export const receiptIssuedAuditInput: AppendAuditRecordInput = {
  eventType:   'RECEIPT_ISSUED',
  payloadJson: {
    itineraryId:      'itin_test_001',
    itineraryVersion:  1,
    outcome:          'PASS',
  },
  dataClassification: DataClassificationTier.INTERNAL,
};

export const ledgerEntryInput: AppendLedgerEntryInput = {
  eventType:    'SOURCING_ORDER',
  actorType:    'SERVICE_PRINCIPAL',
  actorRef:     'svc_test_sourcing_001',
  resourceType: 'TRIP_INTENT',
  resourceRef:  'tip_test_001_00000000-0000-4000-8000-000000000010',
  occurredAt:   new Date('2026-06-30T10:00:00.000Z'),
  correlationId: 'corr_test_001',
  redactedPayloadJson: {
    connectorOrder: ['HVMI'],
    hvmiQueried:    true,
  },
  canonicalHash: 'sha256_placeholder_test_hash_001',
};

// ---------------------------------------------------------------------------
// Version conflict scenario
// ---------------------------------------------------------------------------

export interface VersionConflictScenario {
  /** The status the caller believes the itinerary is in */
  readonly expectedFrom: ItineraryStatus;
  /** The actual current status in the database */
  readonly actualCurrent: ItineraryStatus;
  /** The desired target status */
  readonly targetTo: ItineraryStatus;
}

export const staleVersionScenario: VersionConflictScenario = {
  expectedFrom:  ItineraryStatus.DRAFT,
  actualCurrent: ItineraryStatus.PENDING_VERIFICATION,  // already advanced by another actor
  targetTo:      ItineraryStatus.PENDING_VERIFICATION,
};
