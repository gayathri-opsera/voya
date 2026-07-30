/**
 * TripConfidenceReceiptRepository — interface contract
 *
 * Receipts are append-only. There are no update or delete methods.
 * Each receipt is linked to a specific itinerary version, so historical
 * evidence is never overwritten when a new version is evaluated.
 */

import type { DataClassificationTier } from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

/** Receipt outcome as stored in the persistence layer (superset of contract-layer outcomes) */
export type PersistedReceiptOutcome = 'PASS' | 'FAIL' | 'BLOCKED' | 'STALE';

export interface ReceiptRow {
  readonly id: string;
  readonly itineraryId: string;
  readonly itineraryVersion: number;
  readonly outcome: PersistedReceiptOutcome;
  readonly feasibilityPassed: boolean;
  readonly freshnessGrade: string;
  readonly blockedReasonCode: string | null;
  readonly evaluatedAt: Date;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ReceiptLineItemInput {
  readonly lineItemId: string;
  readonly freshnessGrade: string;
  readonly isAvailabilityStale: boolean;
  readonly isRateStale: boolean;
}

export interface AppendReceiptInput {
  readonly itineraryId: string;
  readonly itineraryVersion: number;
  readonly outcome: PersistedReceiptOutcome;
  readonly feasibilityPassed: boolean;
  readonly freshnessGrade: string;
  readonly blockedReasonCode?: string;
  readonly evaluatedAt: Date;
  readonly lineItems: readonly ReceiptLineItemInput[];
  readonly dataClassification?: DataClassificationTier;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface TripConfidenceReceiptRepository {
  /**
   * Appends a new receipt row and its line-item evidence in one transaction.
   * Never updates or overwrites existing receipts.
   * Returns VALIDATION_FAILURE for empty line items on a PASS outcome.
   */
  appendReceipt(
    input: AppendReceiptInput,
    ownerRef: string,
  ): Promise<RepositoryResult<ReceiptRow>>;

  /**
   * Returns the most recent receipt for an itinerary, or ok(null) when none
   * exists. Returns NOT_FOUND when the itinerary does not exist or ownerRef
   * mismatches.
   */
  findLatestByItineraryId(
    itineraryId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<ReceiptRow | null>>;

  /**
   * Returns all receipts for an itinerary in ascending creation order.
   * Returns NOT_FOUND when the itinerary does not exist or ownerRef mismatches.
   */
  findByItineraryId(
    itineraryId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<ReceiptRow[]>>;
}
