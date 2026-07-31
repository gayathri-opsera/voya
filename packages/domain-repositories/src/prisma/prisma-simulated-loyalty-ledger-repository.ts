/**
 * Prisma-backed SimulatedLoyaltyLedgerRepository implementation.
 *
 * Append-only by construction: every mutating method only ever calls
 * `.create()`, never `.update()` or `.delete()`, on loyalty_quote,
 * loyalty_hold, or loyalty_ledger_entry. Current hold status is derived by
 * reading the ordered ledger entries for a holdId (see deriveHoldStatus in
 * @voya/domain-model), not stored as a mutable column.
 *
 * Idempotency: every mutating method looks up its unique idempotencyKey
 * first and replays the original persisted row on a duplicate request,
 * rather than appending a second row or throwing a unique-constraint error.
 */

import type { PrismaClient } from '@prisma/client';
import {
  DataClassificationTier,
  PointsAdvanceEligibility,
  LoyaltyTransactionType,
  LoyaltyLedgerStatus,
  isActiveHoldStatus,
  isReversibleStatus,
  deriveHoldStatus,
  validateLoyaltyPointsAmount,
  validateMonetaryMinorUnits,
  validateIdempotencyKey,
  validateRedemptionModeInput,
  computeReconciliationTotals,
} from '@voya/domain-model';
import { ok, notFound, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  SimulatedLoyaltyLedgerRepository,
  LoyaltyQuoteRow,
  LoyaltyHoldRow,
  LoyaltyLedgerEntryRow,
  LoyaltyReconciliationSnapshotRow,
  CreateQuoteInput,
  PlaceHoldInput,
  CommitHoldInput,
  ReverseHoldInput,
  AppendAdjustmentInput,
} from '../interfaces/simulated-loyalty-ledger-repository.js';

export class PrismaSimulatedLoyaltyLedgerRepository
  implements SimulatedLoyaltyLedgerRepository
{
  constructor(private readonly db: PrismaClient) {}

  // -------------------------------------------------------------------------
  // createQuote
  // -------------------------------------------------------------------------

  async createQuote(input: CreateQuoteInput): Promise<RepositoryResult<LoyaltyQuoteRow>> {
    const errors = [
      ...validateIdempotencyKey(input.idempotencyKey),
      ...validateOwnerRef(input.ownerRef),
      ...validateRedemptionModeInput(input),
    ];
    if (errors.length > 0) return validationFailure(errors);

    try {
      const existing = await this.db.loyaltyQuote.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return ok(existing as unknown as LoyaltyQuoteRow);

      const created = await this.db.loyaltyQuote.create({
        data: {
          ownerRef:                 input.ownerRef,
          itineraryRef:             input.itineraryRef ?? null,
          sourceLineRef:            input.sourceLineRef ?? null,
          redemptionMode:           input.redemptionMode as never,
          pointsAmount:             input.pointsAmount,
          cashAmountMinorUnits:     input.cashAmountMinorUnits ?? null,
          currencyCode:             input.currencyCode ?? null,
          certificateRef:           input.certificateRef ?? null,
          pointsAdvanceEligibility: (input.pointsAdvanceEligibility ?? PointsAdvanceEligibility.NOT_EVALUATED) as never,
          liabilityCategory:        input.liabilityCategory as never,
          simulated:                true,
          idempotencyKey:           input.idempotencyKey,
          dataClassification:       (input.dataClassification ?? DataClassificationTier.INTERNAL) as never,
        },
      });

      return ok(created as unknown as LoyaltyQuoteRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // placeHold
  // -------------------------------------------------------------------------

  async placeHold(input: PlaceHoldInput): Promise<RepositoryResult<LoyaltyHoldRow>> {
    const errors = [
      ...validateIdempotencyKey(input.idempotencyKey),
      ...validateOwnerRef(input.ownerRef),
      ...validateRedemptionModeInput(input),
    ];
    if (errors.length > 0) return validationFailure(errors);

    try {
      const existing = await this.db.loyaltyHold.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return ok(existing as unknown as LoyaltyHoldRow);

      const created = await this.db.$transaction(async (tx) => {
        const hold = await tx.loyaltyHold.create({
          data: {
            quoteId:              input.quoteId ?? null,
            ownerRef:             input.ownerRef,
            itineraryRef:         input.itineraryRef ?? null,
            sourceLineRef:        input.sourceLineRef ?? null,
            redemptionMode:       input.redemptionMode as never,
            pointsAmount:         input.pointsAmount,
            cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
            currencyCode:         input.currencyCode ?? null,
            simulated:            true,
            idempotencyKey:       input.idempotencyKey,
            expiresAt:            input.expiresAt ?? null,
            dataClassification:  (input.dataClassification ?? DataClassificationTier.INTERNAL) as never,
          },
        });

        await tx.loyaltyLedgerEntry.create({
          data: {
            holdId:               hold.id,
            ownerRef:             input.ownerRef,
            itineraryRef:         input.itineraryRef ?? null,
            sourceLineRef:        input.sourceLineRef ?? null,
            transactionType:      LoyaltyTransactionType.HOLD as never,
            status:               LoyaltyLedgerStatus.HELD as never,
            redemptionMode:       input.redemptionMode as never,
            pointsAmount:         input.pointsAmount,
            cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
            currencyCode:         input.currencyCode ?? null,
            liabilityCategory:    redemptionModeToLiabilityCategory(input.redemptionMode) as never,
            simulated:            true,
            idempotencyKey:       ledgerKey(input.idempotencyKey, 'hold'),
            dataClassification:  (input.dataClassification ?? DataClassificationTier.INTERNAL) as never,
          },
        });

        return hold;
      });

      return ok(created as unknown as LoyaltyHoldRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // commitHold
  // -------------------------------------------------------------------------

  async commitHold(
    input: CommitHoldInput,
  ): Promise<RepositoryResult<LoyaltyLedgerEntryRow>> {
    const errors = validateIdempotencyKey(input.idempotencyKey);
    if (errors.length > 0) return validationFailure(errors);

    try {
      const existingEntry = await this.db.loyaltyLedgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existingEntry) return ok(existingEntry as unknown as LoyaltyLedgerEntryRow);

      const hold = await this.db.loyaltyHold.findUnique({ where: { id: input.holdId } });
      if (!hold || hold.ownerRef !== input.ownerRef) return notFound();

      const priorEntries = await this.db.loyaltyLedgerEntry.findMany({
        where:   { holdId: input.holdId },
        orderBy: { createdAt: 'asc' },
      });
      const currentStatus = deriveHoldStatus(
        priorEntries as unknown as Array<{ status: LoyaltyLedgerStatus }>,
      );
      if (currentStatus === null || !isActiveHoldStatus(currentStatus)) {
        return validationFailure([
          `Hold "${input.holdId}" is not active (current status: ${currentStatus ?? 'UNKNOWN'}); cannot commit`,
        ]);
      }

      const pointsAmount = input.pointsAmount ?? hold.pointsAmount;
      const pointsErrors = validateLoyaltyPointsAmount(pointsAmount);
      if (pointsErrors.length > 0) return validationFailure([...pointsErrors]);
      if (pointsAmount > hold.pointsAmount) {
        return validationFailure([
          `commit pointsAmount ${pointsAmount} must not exceed the held amount ${hold.pointsAmount}`,
        ]);
      }
      if (input.cashAmountMinorUnits !== undefined) {
        const cashErrors = validateMonetaryMinorUnits(input.cashAmountMinorUnits);
        if (cashErrors.length > 0) return validationFailure([...cashErrors]);
      }

      const entry = await this.db.loyaltyLedgerEntry.create({
        data: {
          holdId:               hold.id,
          ownerRef:             input.ownerRef,
          itineraryRef:         hold.itineraryRef,
          sourceLineRef:        hold.sourceLineRef,
          transactionType:      LoyaltyTransactionType.COMMIT as never,
          status:               LoyaltyLedgerStatus.COMMITTED as never,
          redemptionMode:       hold.redemptionMode as never,
          pointsAmount,
          cashAmountMinorUnits: input.cashAmountMinorUnits ?? hold.cashAmountMinorUnits ?? null,
          currencyCode:         hold.currencyCode,
          liabilityCategory:    input.liabilityCategory as never,
          simulated:            true,
          idempotencyKey:       input.idempotencyKey,
          dataClassification:   DataClassificationTier.INTERNAL as never,
        },
      });

      return ok(entry as unknown as LoyaltyLedgerEntryRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // reverseHold
  // -------------------------------------------------------------------------

  async reverseHold(
    input: ReverseHoldInput,
  ): Promise<RepositoryResult<LoyaltyLedgerEntryRow>> {
    const errors = [
      ...validateIdempotencyKey(input.idempotencyKey),
      ...validateLoyaltyPointsAmount(input.pointsAmount),
    ];
    if (errors.length > 0) return validationFailure(errors);

    try {
      const existingEntry = await this.db.loyaltyLedgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existingEntry) return ok(existingEntry as unknown as LoyaltyLedgerEntryRow);

      const hold = await this.db.loyaltyHold.findUnique({ where: { id: input.holdId } });
      if (!hold || hold.ownerRef !== input.ownerRef) return notFound();

      const priorEntries = await this.db.loyaltyLedgerEntry.findMany({
        where:   { holdId: input.holdId },
        orderBy: { createdAt: 'asc' },
      });
      const typedEntries = priorEntries as unknown as Array<{
        status: LoyaltyLedgerStatus;
        transactionType: LoyaltyTransactionType;
        pointsAmount: number;
      }>;
      const currentStatus = deriveHoldStatus(typedEntries);
      if (currentStatus === null || !isReversibleStatus(currentStatus)) {
        return validationFailure([
          `Hold "${input.holdId}" is not reversible (current status: ${currentStatus ?? 'UNKNOWN'})`,
        ]);
      }

      const alreadyReversed = typedEntries
        .filter((e) => e.transactionType === LoyaltyTransactionType.REVERSAL)
        .reduce((sum, e) => sum + e.pointsAmount, 0);
      const remaining = hold.pointsAmount - alreadyReversed;
      if (input.pointsAmount > remaining) {
        return validationFailure([
          `reversal pointsAmount ${input.pointsAmount} exceeds the remaining held/committed amount ${remaining} for hold "${input.holdId}"`,
        ]);
      }
      if (input.cashAmountMinorUnits !== undefined) {
        const cashErrors = validateMonetaryMinorUnits(input.cashAmountMinorUnits);
        if (cashErrors.length > 0) return validationFailure([...cashErrors]);
      }

      const entry = await this.db.loyaltyLedgerEntry.create({
        data: {
          holdId:               hold.id,
          ownerRef:             input.ownerRef,
          itineraryRef:         hold.itineraryRef,
          sourceLineRef:        hold.sourceLineRef,
          transactionType:      LoyaltyTransactionType.REVERSAL as never,
          status:               LoyaltyLedgerStatus.REVERSED as never,
          redemptionMode:       hold.redemptionMode as never,
          pointsAmount:         input.pointsAmount,
          cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
          currencyCode:         hold.currencyCode,
          liabilityCategory:    redemptionModeToLiabilityCategory(hold.redemptionMode as never) as never,
          simulated:            true,
          idempotencyKey:       input.idempotencyKey,
          dataClassification:   DataClassificationTier.INTERNAL as never,
        },
      });

      return ok(entry as unknown as LoyaltyLedgerEntryRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // appendAdjustment
  // -------------------------------------------------------------------------

  async appendAdjustment(
    input: AppendAdjustmentInput,
  ): Promise<RepositoryResult<LoyaltyLedgerEntryRow>> {
    const errors = [
      ...validateIdempotencyKey(input.idempotencyKey),
      ...validateOwnerRef(input.ownerRef),
      ...validateLoyaltyPointsAmount(input.pointsAmount),
    ];
    if (errors.length > 0) return validationFailure(errors);

    try {
      const existingEntry = await this.db.loyaltyLedgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existingEntry) return ok(existingEntry as unknown as LoyaltyLedgerEntryRow);

      if (input.holdId) {
        const hold = await this.db.loyaltyHold.findUnique({ where: { id: input.holdId } });
        if (!hold || hold.ownerRef !== input.ownerRef) return notFound();
      }

      const entry = await this.db.loyaltyLedgerEntry.create({
        data: {
          holdId:               input.holdId ?? null,
          ownerRef:             input.ownerRef,
          itineraryRef:         input.itineraryRef ?? null,
          sourceLineRef:        input.sourceLineRef ?? null,
          transactionType:      LoyaltyTransactionType.ADJUSTMENT as never,
          status:               LoyaltyLedgerStatus.ADJUSTED as never,
          redemptionMode:       input.redemptionMode as never,
          pointsAmount:         input.pointsAmount,
          cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
          currencyCode:         input.currencyCode ?? null,
          liabilityCategory:    input.liabilityCategory as never,
          simulated:            true,
          idempotencyKey:       input.idempotencyKey,
          dataClassification:   DataClassificationTier.INTERNAL as never,
        },
      });

      return ok(entry as unknown as LoyaltyLedgerEntryRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // fetchLedgerByOwner
  // -------------------------------------------------------------------------

  async fetchLedgerByOwner(
    ownerRef: string,
  ): Promise<RepositoryResult<LoyaltyLedgerEntryRow[]>> {
    const errors = validateOwnerRef(ownerRef);
    if (errors.length > 0) return validationFailure(errors);

    try {
      const rows = await this.db.loyaltyLedgerEntry.findMany({
        where:   { ownerRef },
        orderBy: { createdAt: 'asc' },
      });
      return ok(rows as unknown as LoyaltyLedgerEntryRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // fetchHoldStatus
  // -------------------------------------------------------------------------

  async fetchHoldStatus(
    holdId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<LoyaltyLedgerStatus>> {
    try {
      const hold = await this.db.loyaltyHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.ownerRef !== ownerRef) return notFound();

      const entries = await this.db.loyaltyLedgerEntry.findMany({
        where:   { holdId },
        orderBy: { createdAt: 'asc' },
      });
      const status = deriveHoldStatus(
        entries as unknown as Array<{ status: LoyaltyLedgerStatus }>,
      );
      if (status === null) return notFound();
      return ok(status);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // generateReconciliationSnapshot
  // -------------------------------------------------------------------------

  async generateReconciliationSnapshot(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RepositoryResult<LoyaltyReconciliationSnapshotRow>> {
    if (!(periodStart instanceof Date) || !(periodEnd instanceof Date) || periodEnd <= periodStart) {
      return validationFailure(['periodEnd must be strictly after periodStart']);
    }

    try {
      const entries = await this.db.loyaltyLedgerEntry.findMany({
        where: { createdAt: { gte: periodStart, lt: periodEnd } },
      });

      const totals = computeReconciliationTotals(
        entries.map((e) => ({
          transactionType:      e.transactionType as unknown as LoyaltyTransactionType,
          pointsAmount:         e.pointsAmount,
          cashAmountMinorUnits: e.cashAmountMinorUnits,
        })),
      );

      const currencyCode = entries.find((e) => e.currencyCode)?.currencyCode ?? null;

      const snapshot = await this.db.loyaltyReconciliationSnapshot.create({
        data: {
          periodStart,
          periodEnd,
          totalPointsHeld:              totals.totalPointsHeld,
          totalPointsCommitted:         totals.totalPointsCommitted,
          totalPointsReversed:          totals.totalPointsReversed,
          totalCashMinorUnitsCommitted: totals.totalCashMinorUnitsCommitted,
          currencyCode,
          simulated:                    true,
          dataClassification:           DataClassificationTier.INTERNAL as never,
        },
      });

      return ok(snapshot as unknown as LoyaltyReconciliationSnapshotRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateOwnerRef(ownerRef: string): string[] {
  return !ownerRef || ownerRef.trim() === '' ? ['ownerRef must not be empty'] : [];
}

/** Namespaces an idempotency key for a secondary ledger entry derived from a primary caller-supplied key. */
function ledgerKey(idempotencyKey: string, suffix: string): string {
  return `${idempotencyKey}:${suffix}`;
}

/** Maps a redemption mode to its default simulated liability category for HOLD/REVERSAL entries. */
function redemptionModeToLiabilityCategory(
  redemptionMode: string,
): string {
  switch (redemptionMode) {
    case 'STANDARD_AWARD_NIGHT':
      return 'AWARD_NIGHT_REDEMPTION';
    case 'CASH_PLUS_POINTS':
      return 'CASH_PLUS_POINTS_REDEMPTION';
    case 'CERTIFICATE':
      return 'CERTIFICATE_REDEMPTION';
    case 'POINTS_ADVANCE':
      return 'POINTS_ADVANCE_REDEMPTION';
    default:
      return 'ADJUSTMENT';
  }
}

function safeMessage(err: unknown): string {
  if (err instanceof Error)
    return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
