/**
 * SimulatedLoyaltyLedgerRepository — framework-independent interface
 *
 * Voya launches with pseudo/simulated loyalty redemption only. Every row
 * this repository returns or writes carries simulated=true; no method here
 * ever reads, reserves, debits, or credits a real Bonvoy balance.
 *
 * The ledger is append-only: quote, placeHold, commitHold, reverseHold, and
 * appendAdjustment only ever INSERT rows. There are no update or delete
 * methods. Current hold status is derived from the most recent ledger entry
 * for a holdId (see fetchHoldStatus), never stored as a mutable column.
 *
 * All lifecycle-mutating methods require an idempotencyKey. A duplicate
 * request replays the original persisted result rather than appending a
 * duplicate row.
 *
 * No Prisma, Express, or LLM provider imports belong in this file.
 */

import type {
  RedemptionMode,
  PointsAdvanceEligibility,
  SimulatedLiabilityCategory,
  LoyaltyTransactionType,
  LoyaltyLedgerStatus,
  DataClassificationTier,
} from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// Row types returned by the repository
// ---------------------------------------------------------------------------

export interface LoyaltyQuoteRow {
  readonly id: string;
  readonly ownerRef: string;
  readonly itineraryRef: string | null;
  readonly sourceLineRef: string | null;
  readonly redemptionMode: RedemptionMode;
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits: number | null;
  readonly currencyCode: string | null;
  readonly certificateRef: string | null;
  readonly pointsAdvanceEligibility: PointsAdvanceEligibility;
  readonly liabilityCategory: SimulatedLiabilityCategory;
  readonly simulated: boolean;
  readonly idempotencyKey: string;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
}

export interface LoyaltyHoldRow {
  readonly id: string;
  readonly quoteId: string | null;
  readonly ownerRef: string;
  readonly itineraryRef: string | null;
  readonly sourceLineRef: string | null;
  readonly redemptionMode: RedemptionMode;
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits: number | null;
  readonly currencyCode: string | null;
  readonly simulated: boolean;
  readonly idempotencyKey: string;
  readonly expiresAt: Date | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
}

export interface LoyaltyLedgerEntryRow {
  readonly id: string;
  readonly holdId: string | null;
  readonly ownerRef: string;
  readonly itineraryRef: string | null;
  readonly sourceLineRef: string | null;
  readonly transactionType: LoyaltyTransactionType;
  readonly status: LoyaltyLedgerStatus;
  readonly redemptionMode: RedemptionMode;
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits: number | null;
  readonly currencyCode: string | null;
  readonly liabilityCategory: SimulatedLiabilityCategory;
  readonly simulated: boolean;
  readonly idempotencyKey: string;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
}

export interface LoyaltyReconciliationSnapshotRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly totalPointsHeld: number;
  readonly totalPointsCommitted: number;
  readonly totalPointsReversed: number;
  readonly totalCashMinorUnitsCommitted: number;
  readonly currencyCode: string | null;
  readonly simulated: boolean;
  readonly dataClassification: DataClassificationTier;
  readonly generatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateQuoteInput {
  readonly ownerRef: string;
  readonly itineraryRef?: string;
  readonly sourceLineRef?: string;
  readonly redemptionMode: RedemptionMode;
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits?: number;
  readonly currencyCode?: string;
  readonly certificateRef?: string;
  readonly pointsAdvanceEligibility?: PointsAdvanceEligibility;
  readonly liabilityCategory: SimulatedLiabilityCategory;
  readonly idempotencyKey: string;
  readonly dataClassification?: DataClassificationTier;
}

export interface PlaceHoldInput {
  readonly ownerRef: string;
  readonly quoteId?: string;
  readonly itineraryRef?: string;
  readonly sourceLineRef?: string;
  readonly redemptionMode: RedemptionMode;
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits?: number;
  readonly currencyCode?: string;
  readonly idempotencyKey: string;
  readonly expiresAt?: Date;
  readonly dataClassification?: DataClassificationTier;
}

export interface CommitHoldInput {
  readonly holdId: string;
  readonly ownerRef: string;
  readonly idempotencyKey: string;
  readonly liabilityCategory: SimulatedLiabilityCategory;
  /** Final committed points amount; defaults to the hold's full pointsAmount when omitted. */
  readonly pointsAmount?: number;
  readonly cashAmountMinorUnits?: number;
}

export interface ReverseHoldInput {
  readonly holdId: string;
  readonly ownerRef: string;
  readonly idempotencyKey: string;
  /** Points amount being reversed. Must not exceed the held/committed remaining amount. */
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits?: number;
}

export interface AppendAdjustmentInput {
  readonly ownerRef: string;
  readonly holdId?: string;
  readonly itineraryRef?: string;
  readonly sourceLineRef?: string;
  readonly redemptionMode: RedemptionMode;
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits?: number;
  readonly currencyCode?: string;
  readonly liabilityCategory: SimulatedLiabilityCategory;
  readonly idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Repository interface — NO update or delete methods (append-only)
// ---------------------------------------------------------------------------

export interface SimulatedLoyaltyLedgerRepository {
  /** Creates a simulated loyalty quote (an immutable estimate). Idempotent on idempotencyKey. */
  createQuote(input: CreateQuoteInput): Promise<RepositoryResult<LoyaltyQuoteRow>>;

  /**
   * Places a hold and appends the corresponding HOLD ledger entry.
   * Idempotent on idempotencyKey. Returns VALIDATION_FAILURE for invalid
   * redemption-mode-specific fields (see validateRedemptionModeInput).
   */
  placeHold(input: PlaceHoldInput): Promise<RepositoryResult<LoyaltyHoldRow>>;

  /**
   * Commits an active hold, appending a COMMIT ledger entry.
   * Returns NOT_FOUND when the hold does not exist or belongs to another
   * owner. Returns VALIDATION_FAILURE when the hold's derived status is not
   * HELD (missing, expired, already reversed, or already committed).
   * Idempotent on idempotencyKey.
   */
  commitHold(input: CommitHoldInput): Promise<RepositoryResult<LoyaltyLedgerEntryRow>>;

  /**
   * Reverses points/cash against a hold, appending a REVERSAL ledger entry.
   * Returns NOT_FOUND for missing/cross-owner holds. Returns
   * VALIDATION_FAILURE when the hold's derived status is not reversible, or
   * when pointsAmount would exceed the held/committed remaining amount.
   * Idempotent on idempotencyKey.
   */
  reverseHold(input: ReverseHoldInput): Promise<RepositoryResult<LoyaltyLedgerEntryRow>>;

  /**
   * Appends a standalone ADJUSTMENT ledger entry (e.g. finance correction),
   * optionally linked to an existing hold. Idempotent on idempotencyKey.
   */
  appendAdjustment(input: AppendAdjustmentInput): Promise<RepositoryResult<LoyaltyLedgerEntryRow>>;

  /** Returns all ledger entries for ownerRef, ordered by createdAt ascending. */
  fetchLedgerByOwner(ownerRef: string): Promise<RepositoryResult<LoyaltyLedgerEntryRow[]>>;

  /**
   * Returns the derived current status of a hold (from its most recent
   * ledger entry). Returns NOT_FOUND for missing/cross-owner holds.
   */
  fetchHoldStatus(
    holdId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<LoyaltyLedgerStatus>>;

  /**
   * Computes and persists a reconciliation snapshot for [periodStart, periodEnd)
   * from ledger entries created in that window. The snapshot row itself is
   * never updated after creation.
   */
  generateReconciliationSnapshot(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RepositoryResult<LoyaltyReconciliationSnapshotRow>>;
}
