/**
 * Prisma-backed SimulatedLoyaltyLedgerRepository implementation.
 *
 * Enforces append-only semantics (ledger entries are never updated), idempotent
 * lifecycle operations via idempotencyKey, and the simulated=true invariant.
 * Holds must be ACTIVE before commit or reversal. Reversal is guarded against
 * exceeding the held points amount. No real Bonvoy balance is touched.
 */

import type { PrismaClient } from '@prisma/client';
import {
  DataClassificationTier,
  LoyaltyTransactionType,
  LoyaltyLedgerStatus,
  RedemptionMode,
  PointsAdvanceEligibility,
  SimulatedLiabilityCategory,
  validateIdempotencyKey,
  validatePointsAmountLoyalty,
  validateCashMinorUnits,
  validateCurrencyCode,
  validateReversalAmount,
  computeReconciliationSummary,
  isValidHoldTransition,
} from '@voya/domain-model';
import type { LedgerEntryInput } from '@voya/domain-model';
import { ok, notFound, expired, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  SimulatedLoyaltyLedgerRepository,
  LoyaltyQuoteRow,
  LoyaltyHoldRow,
  LoyaltyLedgerEntryRow,
  LoyaltyReconciliationSnapshotRow,
  CertificateReferenceRow,
  CreateQuoteInput,
  PlaceHoldInput,
  AppendAdjustmentInput,
} from '../interfaces/simulated-loyalty-ledger-repository.js';

// Prisma transaction client type
type PrismaTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class PrismaSimulatedLoyaltyLedgerRepository implements SimulatedLoyaltyLedgerRepository {
  constructor(private readonly db: PrismaClient) {}

  // -------------------------------------------------------------------------
  // createQuote
  // -------------------------------------------------------------------------

  async createQuote(input: CreateQuoteInput): Promise<RepositoryResult<LoyaltyQuoteRow>> {
    const errors = validateCreateQuoteInput(input);
    if (errors.length > 0) return validationFailure(errors);

    try {
      // Idempotency: return existing quote if key already used
      const existing = await this.db.loyaltyQuote.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return ok(toQuoteRow(existing as QuotePrismaRow));

      const row = await this.db.loyaltyQuote.create({
        data: {
          ownerRef:                 input.ownerRef,
          idempotencyKey:           input.idempotencyKey,
          itineraryRef:             input.itineraryRef ?? null,
          cartRef:                  input.cartRef ?? null,
          lineItemRef:              input.lineItemRef ?? null,
          redemptionMode:           input.redemptionMode as never,
          pointsAmount:             input.pointsAmount,
          cashAmountMinorUnits:     input.cashAmountMinorUnits ?? null,
          currencyCode:             input.currencyCode ?? null,
          estimatedEarnPoints:      input.estimatedEarnPoints ?? null,
          pointsAdvanceEligibility: (input.pointsAdvanceEligibility ?? PointsAdvanceEligibility.NOT_ELIGIBLE) as never,
          certificateRef:           input.certificateRef ?? null,
          simulated:                true,
          status:                   LoyaltyLedgerStatus.PENDING as never,
          expiresAt:                input.expiresAt ?? null,
          dataClassification:       DataClassificationTier.CONFIDENTIAL as never,
        },
      });

      return ok(toQuoteRow(row as QuotePrismaRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // placeHold
  // -------------------------------------------------------------------------

  async placeHold(input: PlaceHoldInput): Promise<RepositoryResult<LoyaltyHoldRow>> {
    const errors = validatePlaceHoldInput(input);
    if (errors.length > 0) return validationFailure(errors);

    try {
      // Idempotency: return existing hold if key already used
      const existing = await this.db.loyaltyHold.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return ok(toHoldRow(existing as HoldPrismaRow));

      // Verify quote ownership and status
      const quote = await this.db.loyaltyQuote.findUnique({ where: { id: input.quoteId } });
      if (!quote || quote.ownerRef !== input.ownerRef) return notFound();
      if (quote.expiresAt && quote.expiresAt <= new Date()) return expired(quote.expiresAt as Date);
      if (isTerminalStatus(quote.status as string)) {
        return validationFailure([`quote is in terminal status ${quote.status} — cannot place hold`]);
      }

      const hold = await this.db.$transaction(async (tx: PrismaTx) => {
        const h = await tx.loyaltyHold.create({
          data: {
            ownerRef:             input.ownerRef,
            quoteId:              input.quoteId,
            idempotencyKey:       input.idempotencyKey,
            pointsAmount:         input.pointsAmount,
            cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
            currencyCode:         input.currencyCode ?? null,
            simulated:            true,
            status:               LoyaltyLedgerStatus.ACTIVE as never,
            expiresAt:            input.expiresAt ?? null,
            transactionRef:       input.transactionRef,
            dataClassification:   DataClassificationTier.CONFIDENTIAL as never,
          },
        });

        await tx.loyaltyLedgerEntry.create({
          data: {
            ownerRef:             input.ownerRef,
            quoteId:              input.quoteId,
            holdId:               h.id,
            idempotencyKey:       `${input.idempotencyKey}:ledger`,
            transactionType:      LoyaltyTransactionType.HOLD_PLACED as never,
            liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_HOLD as never,
            pointsAmount:         input.pointsAmount,
            cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
            currencyCode:         input.currencyCode ?? null,
            itineraryRef:         null,
            cartRef:              null,
            lineItemRef:          null,
            simulated:            true,
            status:               LoyaltyLedgerStatus.ACTIVE as never,
            dataClassification:   DataClassificationTier.CONFIDENTIAL as never,
          },
        });

        return h;
      });

      return ok(toHoldRow(hold as HoldPrismaRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // commitHold
  // -------------------------------------------------------------------------

  async commitHold(
    holdId: string,
    ownerRef: string,
    idempotencyKey: string,
  ): Promise<RepositoryResult<LoyaltyHoldRow>> {
    const keyErrors = validateIdempotencyKey(idempotencyKey);
    if (keyErrors.length > 0) return validationFailure([...keyErrors]);
    if (!holdId || holdId.trim() === '') return validationFailure(['holdId must not be empty']);
    if (!ownerRef || ownerRef.trim() === '') return validationFailure(['ownerRef must not be empty']);

    try {
      // Idempotency: if already committed via this key, return existing entry
      const existingEntry = await this.db.loyaltyLedgerEntry.findUnique({
        where: { idempotencyKey: `${idempotencyKey}:commit` },
      });
      if (existingEntry) {
        const hold = await this.db.loyaltyHold.findUnique({ where: { id: holdId } });
        if (hold) return ok(toHoldRow(hold as HoldPrismaRow));
      }

      const hold = await this.db.loyaltyHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.ownerRef !== ownerRef) return notFound();
      if (hold.expiresAt && (hold.expiresAt as Date) <= new Date()) return expired(hold.expiresAt as Date);

      if (hold.status !== LoyaltyLedgerStatus.ACTIVE) {
        return validationFailure([
          `hold is in status ${hold.status} — only ACTIVE holds can be committed (simulated lifecycle guard)`,
        ]);
      }

      const updated = await this.db.$transaction(async (tx: PrismaTx) => {
        const h = await tx.loyaltyHold.update({
          where: { id: holdId },
          data:  { status: LoyaltyLedgerStatus.COMMITTED as never },
        });

        await tx.loyaltyLedgerEntry.create({
          data: {
            ownerRef:             ownerRef,
            quoteId:              hold.quoteId,
            holdId:               holdId,
            idempotencyKey:       `${idempotencyKey}:commit`,
            transactionType:      LoyaltyTransactionType.HOLD_COMMITTED as never,
            liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_COMMIT as never,
            pointsAmount:         hold.pointsAmount,
            cashAmountMinorUnits: hold.cashAmountMinorUnits ?? null,
            currencyCode:         hold.currencyCode ?? null,
            itineraryRef:         null,
            cartRef:              null,
            lineItemRef:          null,
            simulated:            true,
            status:               LoyaltyLedgerStatus.COMMITTED as never,
            dataClassification:   DataClassificationTier.CONFIDENTIAL as never,
          },
        });

        return h;
      });

      return ok(toHoldRow(updated as HoldPrismaRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // reverseHold
  // -------------------------------------------------------------------------

  async reverseHold(
    holdId: string,
    ownerRef: string,
    idempotencyKey: string,
    pointsToReverse: number,
  ): Promise<RepositoryResult<LoyaltyHoldRow>> {
    const keyErrors = validateIdempotencyKey(idempotencyKey);
    if (keyErrors.length > 0) return validationFailure([...keyErrors]);
    if (!holdId || holdId.trim() === '') return validationFailure(['holdId must not be empty']);
    if (!ownerRef || ownerRef.trim() === '') return validationFailure(['ownerRef must not be empty']);

    try {
      // Idempotency: if already reversed via this key, return current hold state
      const existingEntry = await this.db.loyaltyLedgerEntry.findUnique({
        where: { idempotencyKey: `${idempotencyKey}:reverse` },
      });
      if (existingEntry) {
        const hold = await this.db.loyaltyHold.findUnique({ where: { id: holdId } });
        if (hold) return ok(toHoldRow(hold as HoldPrismaRow));
      }

      const hold = await this.db.loyaltyHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.ownerRef !== ownerRef) return notFound();
      if (hold.expiresAt && (hold.expiresAt as Date) <= new Date()) return expired(hold.expiresAt as Date);

      // Only ACTIVE or COMMITTED holds can be reversed
      if (hold.status !== LoyaltyLedgerStatus.ACTIVE && hold.status !== LoyaltyLedgerStatus.COMMITTED) {
        return validationFailure([
          `hold is in status ${hold.status} — only ACTIVE or COMMITTED holds can be reversed`,
        ]);
      }

      const reversalErrors = validateReversalAmount(pointsToReverse, hold.pointsAmount);
      if (reversalErrors.length > 0) return validationFailure([...reversalErrors]);

      const updated = await this.db.$transaction(async (tx: PrismaTx) => {
        const h = await tx.loyaltyHold.update({
          where: { id: holdId },
          data:  { status: LoyaltyLedgerStatus.REVERSED as never },
        });

        await tx.loyaltyLedgerEntry.create({
          data: {
            ownerRef:             ownerRef,
            quoteId:              hold.quoteId,
            holdId:               holdId,
            idempotencyKey:       `${idempotencyKey}:reverse`,
            transactionType:      LoyaltyTransactionType.HOLD_REVERSED as never,
            liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_HOLD as never,
            pointsAmount:         pointsToReverse,
            cashAmountMinorUnits: null,
            currencyCode:         hold.currencyCode ?? null,
            itineraryRef:         null,
            cartRef:              null,
            lineItemRef:          null,
            simulated:            true,
            status:               LoyaltyLedgerStatus.REVERSED as never,
            dataClassification:   DataClassificationTier.CONFIDENTIAL as never,
          },
        });

        return h;
      });

      return ok(toHoldRow(updated as HoldPrismaRow));
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
    if (!input.ownerRef || input.ownerRef.trim() === '') {
      return validationFailure(['ownerRef must not be empty']);
    }
    const keyErrors = validateIdempotencyKey(input.idempotencyKey);
    if (keyErrors.length > 0) return validationFailure([...keyErrors]);

    const ptsErrors = validatePointsAmountLoyalty(input.pointsAmount);
    if (ptsErrors.length > 0) return validationFailure([...ptsErrors]);

    if (input.cashAmountMinorUnits !== undefined) {
      const cashErrors = validateCashMinorUnits(input.cashAmountMinorUnits);
      if (cashErrors.length > 0) return validationFailure([...cashErrors]);
    }
    if (input.currencyCode) {
      const ccErrors = validateCurrencyCode(input.currencyCode);
      if (ccErrors.length > 0) return validationFailure([...ccErrors]);
    }

    try {
      // Idempotency
      const existing = await this.db.loyaltyLedgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return ok(toEntryRow(existing as EntryPrismaRow));

      const row = await this.db.loyaltyLedgerEntry.create({
        data: {
          ownerRef:             input.ownerRef,
          quoteId:              null,
          holdId:               null,
          idempotencyKey:       input.idempotencyKey,
          transactionType:      LoyaltyTransactionType.ADJUSTMENT as never,
          liabilityCategory:    input.liabilityCategory as never,
          pointsAmount:         input.pointsAmount,
          cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
          currencyCode:         input.currencyCode ?? null,
          itineraryRef:         input.itineraryRef ?? null,
          cartRef:              input.cartRef ?? null,
          lineItemRef:          input.lineItemRef ?? null,
          simulated:            true,
          status:               LoyaltyLedgerStatus.ACTIVE as never,
          dataClassification:   DataClassificationTier.CONFIDENTIAL as never,
        },
      });

      return ok(toEntryRow(row as EntryPrismaRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // fetchLedgerByOwner
  // -------------------------------------------------------------------------

  async fetchLedgerByOwner(ownerRef: string): Promise<RepositoryResult<LoyaltyLedgerEntryRow[]>> {
    if (!ownerRef || ownerRef.trim() === '') {
      return validationFailure(['ownerRef must not be empty']);
    }

    try {
      const rows = await this.db.loyaltyLedgerEntry.findMany({
        where:   { ownerRef },
        orderBy: { createdAt: 'desc' },
      });

      return ok(rows.map(r => toEntryRow(r as EntryPrismaRow)));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // generateReconciliationSnapshot
  // -------------------------------------------------------------------------

  async generateReconciliationSnapshot(
    ownerRef: string,
    snapshotPeriod: string,
  ): Promise<RepositoryResult<LoyaltyReconciliationSnapshotRow>> {
    if (!ownerRef || ownerRef.trim() === '') {
      return validationFailure(['ownerRef must not be empty']);
    }
    if (!snapshotPeriod || snapshotPeriod.trim() === '') {
      return validationFailure(['snapshotPeriod must not be empty']);
    }

    try {
      // Return existing snapshot if already generated for this period
      const existing = await this.db.loyaltyReconciliationSnapshot.findFirst({
        where: { ownerRef, snapshotPeriod },
      });
      if (existing) return ok(toSnapshotRow(existing as SnapshotPrismaRow));

      // Compute from ledger entries
      const entries = await this.db.loyaltyLedgerEntry.findMany({
        where: { ownerRef },
      });

      const ledgerInputs: LedgerEntryInput[] = entries.map(e => ({
        transactionType:      e.transactionType as LoyaltyTransactionType,
        liabilityCategory:    e.liabilityCategory as SimulatedLiabilityCategory,
        pointsAmount:         e.pointsAmount,
        cashAmountMinorUnits: e.cashAmountMinorUnits ?? undefined,
        status:               e.status as LoyaltyLedgerStatus,
      }));

      const summary = computeReconciliationSummary(ledgerInputs);

      // Determine currencyCode from most recent entry with a currency
      const currencyRow = entries.find(e => e.currencyCode);
      const currencyCode = currencyRow?.currencyCode ?? null;

      const snapshot = await this.db.loyaltyReconciliationSnapshot.create({
        data: {
          ownerRef,
          snapshotPeriod,
          totalSimulatedEarnPoints:      summary.totalSimulatedEarnPoints,
          totalSimulatedHeldPoints:      summary.totalSimulatedHeldPoints,
          totalSimulatedCommittedPoints: summary.totalSimulatedCommittedPoints,
          totalSimulatedReversedPoints:  summary.totalSimulatedReversedPoints,
          totalCashMinorUnits:           summary.totalCashMinorUnits,
          currencyCode,
          entryCount:                    summary.entryCount,
          simulated:                     true,
          dataClassification:            DataClassificationTier.CONFIDENTIAL as never,
        },
      });

      return ok(toSnapshotRow(snapshot as SnapshotPrismaRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // fetchCertificate
  // -------------------------------------------------------------------------

  async fetchCertificate(
    ownerRef: string,
    certificateRef: string,
  ): Promise<RepositoryResult<CertificateReferenceRow>> {
    if (!ownerRef || ownerRef.trim() === '') return validationFailure(['ownerRef must not be empty']);
    if (!certificateRef || certificateRef.trim() === '') return validationFailure(['certificateRef must not be empty']);

    try {
      const row = await this.db.certificateReference.findFirst({
        where: { ownerRef, certificateRef },
      });
      // Resource enumeration guard: cross-owner or missing returns NOT_FOUND
      if (!row) return notFound();
      return ok(toCertRow(row as CertPrismaRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateCreateQuoteInput(input: CreateQuoteInput): string[] {
  const errors: string[] = [];
  if (!input.ownerRef || input.ownerRef.trim() === '') errors.push('ownerRef must not be empty');
  errors.push(...validateIdempotencyKey(input.idempotencyKey));
  errors.push(...validatePointsAmountLoyalty(input.pointsAmount));
  if (input.cashAmountMinorUnits !== undefined)
    errors.push(...validateCashMinorUnits(input.cashAmountMinorUnits));
  if (input.currencyCode)
    errors.push(...validateCurrencyCode(input.currencyCode));
  if (input.estimatedEarnPoints !== undefined)
    errors.push(...validatePointsAmountLoyalty(input.estimatedEarnPoints));
  return errors;
}

function validatePlaceHoldInput(input: PlaceHoldInput): string[] {
  const errors: string[] = [];
  if (!input.ownerRef || input.ownerRef.trim() === '') errors.push('ownerRef must not be empty');
  if (!input.quoteId || input.quoteId.trim() === '') errors.push('quoteId must not be empty');
  errors.push(...validateIdempotencyKey(input.idempotencyKey));
  errors.push(...validatePointsAmountLoyalty(input.pointsAmount));
  if (input.cashAmountMinorUnits !== undefined)
    errors.push(...validateCashMinorUnits(input.cashAmountMinorUnits));
  if (input.currencyCode)
    errors.push(...validateCurrencyCode(input.currencyCode));
  if (!input.transactionRef || input.transactionRef.trim() === '')
    errors.push('transactionRef must not be empty');
  return errors;
}

function isTerminalStatus(status: string): boolean {
  return (
    status === LoyaltyLedgerStatus.COMMITTED ||
    status === LoyaltyLedgerStatus.REVERSED  ||
    status === LoyaltyLedgerStatus.EXPIRED   ||
    status === LoyaltyLedgerStatus.REJECTED
  );
}

function safeMessage(err: unknown): string {
  if (err instanceof Error)
    return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

interface QuotePrismaRow {
  id: string; ownerRef: string; idempotencyKey: string; itineraryRef: string | null;
  cartRef: string | null; lineItemRef: string | null; redemptionMode: unknown;
  pointsAmount: number; cashAmountMinorUnits: number | null; currencyCode: string | null;
  estimatedEarnPoints: number | null; pointsAdvanceEligibility: unknown;
  certificateRef: string | null; simulated: boolean; status: unknown;
  expiresAt: Date | null; dataClassification: unknown; createdAt: Date; updatedAt: Date;
}

interface HoldPrismaRow {
  id: string; ownerRef: string; quoteId: string; idempotencyKey: string;
  pointsAmount: number; cashAmountMinorUnits: number | null; currencyCode: string | null;
  simulated: boolean; status: unknown; expiresAt: Date | null; transactionRef: string;
  dataClassification: unknown; createdAt: Date; updatedAt: Date;
}

interface EntryPrismaRow {
  id: string; ownerRef: string; quoteId: string | null; holdId: string | null;
  idempotencyKey: string; transactionType: unknown; liabilityCategory: unknown;
  pointsAmount: number; cashAmountMinorUnits: number | null; currencyCode: string | null;
  itineraryRef: string | null; cartRef: string | null; lineItemRef: string | null;
  simulated: boolean; status: unknown; dataClassification: unknown; createdAt: Date;
}

interface SnapshotPrismaRow {
  id: string; ownerRef: string; snapshotPeriod: string;
  totalSimulatedEarnPoints: number; totalSimulatedHeldPoints: number;
  totalSimulatedCommittedPoints: number; totalSimulatedReversedPoints: number;
  totalCashMinorUnits: number; currencyCode: string | null; entryCount: number;
  simulated: boolean; generatedAt: Date; dataClassification: unknown; createdAt: Date;
}

interface CertPrismaRow {
  id: string; ownerRef: string; certificateRef: string; certificateType: string;
  pointsValue: number; expiresAt: Date | null; simulated: boolean; status: unknown;
  dataClassification: unknown; createdAt: Date; updatedAt: Date;
}

function toQuoteRow(r: QuotePrismaRow): LoyaltyQuoteRow {
  return {
    id:                       r.id,
    ownerRef:                 r.ownerRef,
    idempotencyKey:           r.idempotencyKey,
    itineraryRef:             r.itineraryRef,
    cartRef:                  r.cartRef,
    lineItemRef:              r.lineItemRef,
    redemptionMode:           r.redemptionMode as RedemptionMode,
    pointsAmount:             r.pointsAmount,
    cashAmountMinorUnits:     r.cashAmountMinorUnits,
    currencyCode:             r.currencyCode,
    estimatedEarnPoints:      r.estimatedEarnPoints,
    pointsAdvanceEligibility: r.pointsAdvanceEligibility as PointsAdvanceEligibility,
    certificateRef:           r.certificateRef,
    simulated:                true,
    status:                   r.status as LoyaltyLedgerStatus,
    expiresAt:                r.expiresAt,
    dataClassification:       r.dataClassification as DataClassificationTier,
    createdAt:                r.createdAt,
    updatedAt:                r.updatedAt,
  };
}

function toHoldRow(r: HoldPrismaRow): LoyaltyHoldRow {
  return {
    id:                   r.id,
    ownerRef:             r.ownerRef,
    quoteId:              r.quoteId,
    idempotencyKey:       r.idempotencyKey,
    pointsAmount:         r.pointsAmount,
    cashAmountMinorUnits: r.cashAmountMinorUnits,
    currencyCode:         r.currencyCode,
    simulated:            true,
    status:               r.status as LoyaltyLedgerStatus,
    expiresAt:            r.expiresAt,
    transactionRef:       r.transactionRef,
    dataClassification:   r.dataClassification as DataClassificationTier,
    createdAt:            r.createdAt,
    updatedAt:            r.updatedAt,
  };
}

function toEntryRow(r: EntryPrismaRow): LoyaltyLedgerEntryRow {
  return {
    id:                   r.id,
    ownerRef:             r.ownerRef,
    quoteId:              r.quoteId,
    holdId:               r.holdId,
    idempotencyKey:       r.idempotencyKey,
    transactionType:      r.transactionType as LoyaltyTransactionType,
    liabilityCategory:    r.liabilityCategory as SimulatedLiabilityCategory,
    pointsAmount:         r.pointsAmount,
    cashAmountMinorUnits: r.cashAmountMinorUnits,
    currencyCode:         r.currencyCode,
    itineraryRef:         r.itineraryRef,
    cartRef:              r.cartRef,
    lineItemRef:          r.lineItemRef,
    simulated:            true,
    status:               r.status as LoyaltyLedgerStatus,
    dataClassification:   r.dataClassification as DataClassificationTier,
    createdAt:            r.createdAt,
  };
}

function toSnapshotRow(r: SnapshotPrismaRow): LoyaltyReconciliationSnapshotRow {
  return {
    id:                            r.id,
    ownerRef:                      r.ownerRef,
    snapshotPeriod:                r.snapshotPeriod,
    totalSimulatedEarnPoints:      r.totalSimulatedEarnPoints,
    totalSimulatedHeldPoints:      r.totalSimulatedHeldPoints,
    totalSimulatedCommittedPoints: r.totalSimulatedCommittedPoints,
    totalSimulatedReversedPoints:  r.totalSimulatedReversedPoints,
    totalCashMinorUnits:           r.totalCashMinorUnits,
    currencyCode:                  r.currencyCode,
    entryCount:                    r.entryCount,
    simulated:                     true,
    generatedAt:                   r.generatedAt,
    dataClassification:            r.dataClassification as DataClassificationTier,
    createdAt:                     r.createdAt,
  };
}

function toCertRow(r: CertPrismaRow): CertificateReferenceRow {
  return {
    id:                 r.id,
    ownerRef:           r.ownerRef,
    certificateRef:     r.certificateRef,
    certificateType:    r.certificateType,
    pointsValue:        r.pointsValue,
    expiresAt:          r.expiresAt,
    simulated:          true,
    status:             r.status as LoyaltyLedgerStatus,
    dataClassification: r.dataClassification as DataClassificationTier,
    createdAt:          r.createdAt,
    updatedAt:          r.updatedAt,
  };
}
