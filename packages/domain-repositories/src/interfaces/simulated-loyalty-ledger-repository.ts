/**
 * SimulatedLoyaltyLedgerRepository — framework-independent interface
 *
 * ALL operations are SIMULATED — no real Bonvoy balance is debited at any
 * point. The ledger is append-only: prior entries are never mutated. Status
 * projections are derived from the current ledger state.
 *
 * Idempotency contract: all mutation methods accept idempotencyKey. A
 * duplicate call with the same key returns the original persisted result
 * rather than appending a new entry.
 *
 * No Prisma, HTTP, or LLM imports.
 */

import type {
  LoyaltyTransactionType,
  LoyaltyLedgerStatus,
  RedemptionMode,
  PointsAdvanceEligibility,
  SimulatedLiabilityCategory,
  ReconciliationSummary,
} from '@voya/domain-model';
import type { DataClassificationTier } from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface LoyaltyQuoteRow {
  readonly id:                       string;
  readonly ownerRef:                 string;
  readonly idempotencyKey:           string;
  readonly itineraryRef:             string | null;
  readonly cartRef:                  string | null;
  readonly lineItemRef:              string | null;
  readonly redemptionMode:           RedemptionMode;
  readonly pointsAmount:             number;
  readonly cashAmountMinorUnits:     number | null;
  readonly currencyCode:             string | null;
  readonly estimatedEarnPoints:      number | null;
  readonly pointsAdvanceEligibility: PointsAdvanceEligibility;
  readonly certificateRef:           string | null;
  readonly simulated:                true;
  readonly status:                   LoyaltyLedgerStatus;
  readonly expiresAt:                Date | null;
  readonly dataClassification:       DataClassificationTier;
  readonly createdAt:                Date;
  readonly updatedAt:                Date;
}

export interface LoyaltyHoldRow {
  readonly id:                   string;
  readonly ownerRef:             string;
  readonly quoteId:              string;
  readonly idempotencyKey:       string;
  readonly pointsAmount:         number;
  readonly cashAmountMinorUnits: number | null;
  readonly currencyCode:         string | null;
  readonly simulated:            true;
  readonly status:               LoyaltyLedgerStatus;
  readonly expiresAt:            Date | null;
  readonly transactionRef:       string;
  readonly dataClassification:   DataClassificationTier;
  readonly createdAt:            Date;
  readonly updatedAt:            Date;
}

export interface LoyaltyLedgerEntryRow {
  readonly id:                   string;
  readonly ownerRef:             string;
  readonly quoteId:              string | null;
  readonly holdId:               string | null;
  readonly idempotencyKey:       string;
  readonly transactionType:      LoyaltyTransactionType;
  readonly liabilityCategory:    SimulatedLiabilityCategory;
  readonly pointsAmount:         number;
  readonly cashAmountMinorUnits: number | null;
  readonly currencyCode:         string | null;
  readonly itineraryRef:         string | null;
  readonly cartRef:              string | null;
  readonly lineItemRef:          string | null;
  readonly simulated:            true;
  readonly status:               LoyaltyLedgerStatus;
  readonly dataClassification:   DataClassificationTier;
  readonly createdAt:            Date;
}

export interface LoyaltyReconciliationSnapshotRow {
  readonly id:                            string;
  readonly ownerRef:                      string;
  readonly snapshotPeriod:                string;
  readonly totalSimulatedEarnPoints:      number;
  readonly totalSimulatedHeldPoints:      number;
  readonly totalSimulatedCommittedPoints: number;
  readonly totalSimulatedReversedPoints:  number;
  readonly totalCashMinorUnits:           number;
  readonly currencyCode:                  string | null;
  readonly entryCount:                    number;
  readonly simulated:                     true;
  readonly generatedAt:                   Date;
  readonly dataClassification:            DataClassificationTier;
  readonly createdAt:                     Date;
}

export interface CertificateReferenceRow {
  readonly id:                 string;
  readonly ownerRef:           string;
  readonly certificateRef:     string;
  readonly certificateType:    string;
  readonly pointsValue:        number;
  readonly expiresAt:          Date | null;
  readonly simulated:          true;
  readonly status:             LoyaltyLedgerStatus;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt:          Date;
  readonly updatedAt:          Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateQuoteInput {
  readonly ownerRef:                 string;
  readonly idempotencyKey:           string;
  readonly itineraryRef?:            string;
  readonly cartRef?:                 string;
  readonly lineItemRef?:             string;
  readonly redemptionMode:           RedemptionMode;
  readonly pointsAmount:             number;
  readonly cashAmountMinorUnits?:    number;
  readonly currencyCode?:            string;
  readonly estimatedEarnPoints?:     number;
  readonly pointsAdvanceEligibility?: PointsAdvanceEligibility;
  readonly certificateRef?:          string;
  readonly expiresAt?:               Date;
}

export interface PlaceHoldInput {
  readonly ownerRef:             string;
  readonly quoteId:              string;
  readonly idempotencyKey:       string;
  readonly pointsAmount:         number;
  readonly cashAmountMinorUnits?: number;
  readonly currencyCode?:        string;
  readonly expiresAt?:           Date;
  readonly transactionRef:       string;
}

export interface AppendAdjustmentInput {
  readonly ownerRef:              string;
  readonly idempotencyKey:        string;
  readonly pointsAmount:          number;
  readonly cashAmountMinorUnits?: number;
  readonly currencyCode?:         string;
  readonly itineraryRef?:         string;
  readonly cartRef?:              string;
  readonly lineItemRef?:          string;
  readonly liabilityCategory:     SimulatedLiabilityCategory;
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface SimulatedLoyaltyLedgerRepository {
  /**
   * Create a simulated loyalty quote. Idempotent: a duplicate idempotencyKey
   * returns the original row unchanged.
   *
   * Returns VALIDATION_FAILURE for invalid amounts, currency code, or key.
   */
  createQuote(input: CreateQuoteInput): Promise<RepositoryResult<LoyaltyQuoteRow>>;

  /**
   * Place a simulated hold against an existing quote. Idempotent via
   * idempotencyKey.
   *
   * Returns NOT_FOUND if the quote does not exist or belongs to another owner.
   * Returns VALIDATION_FAILURE if the quote is in a terminal status.
   * Returns EXPIRED if the quote's expiresAt is in the past.
   */
  placeHold(input: PlaceHoldInput): Promise<RepositoryResult<LoyaltyHoldRow>>;

  /**
   * Commit a simulated hold. Idempotent via idempotencyKey.
   *
   * Returns NOT_FOUND if the hold does not exist or belongs to another owner.
   * Returns VALIDATION_FAILURE if the hold is not in ACTIVE status.
   * Returns EXPIRED if the hold's expiresAt is in the past.
   */
  commitHold(
    holdId: string,
    ownerRef: string,
    idempotencyKey: string,
  ): Promise<RepositoryResult<LoyaltyHoldRow>>;

  /**
   * Reverse a simulated hold. Idempotent via idempotencyKey.
   * pointsToReverse must not exceed the hold's pointsAmount.
   *
   * Returns NOT_FOUND if the hold does not exist or belongs to another owner.
   * Returns VALIDATION_FAILURE for over-reversal or invalid hold status.
   */
  reverseHold(
    holdId: string,
    ownerRef: string,
    idempotencyKey: string,
    pointsToReverse: number,
  ): Promise<RepositoryResult<LoyaltyHoldRow>>;

  /**
   * Append a standalone adjustment entry. Idempotent via idempotencyKey.
   * Does not require a hold or quote reference.
   */
  appendAdjustment(input: AppendAdjustmentInput): Promise<RepositoryResult<LoyaltyLedgerEntryRow>>;

  /**
   * Fetch all ledger entries for an owner in descending createdAt order.
   * Returns an empty array if no entries exist for the owner.
   */
  fetchLedgerByOwner(ownerRef: string): Promise<RepositoryResult<LoyaltyLedgerEntryRow[]>>;

  /**
   * Generate or retrieve a reconciliation snapshot for an owner and period
   * (e.g. "2025-Q2", "2025-06"). If one already exists for the period, the
   * existing snapshot is returned rather than a duplicate being created.
   *
   * Returns VALIDATION_FAILURE for an empty snapshotPeriod.
   */
  generateReconciliationSnapshot(
    ownerRef: string,
    snapshotPeriod: string,
  ): Promise<RepositoryResult<LoyaltyReconciliationSnapshotRow>>;

  /**
   * Fetch a certificate reference by ownerRef and certificateRef.
   * Returns NOT_FOUND for cross-owner or missing refs (enumeration guard).
   */
  fetchCertificate(
    ownerRef: string,
    certificateRef: string,
  ): Promise<RepositoryResult<CertificateReferenceRow>>;
}
