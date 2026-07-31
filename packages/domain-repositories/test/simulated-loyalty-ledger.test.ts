/**
 * Unit tests for @voya/domain-repositories — SimulatedLoyaltyLedgerRepository
 *
 * Uses an in-memory fake implementation — no database required. Tests prove:
 *  - Every persisted quote/hold/ledger entry carries simulated=true
 *  - Lifecycle transitions (quote -> hold -> commit / reverse) behave correctly
 *  - Append-only enforcement: no update/delete method exists on the interface
 *  - Reversal cannot exceed the held/committed amount
 *  - Duplicate idempotencyKey requests replay the original result
 *  - Reconciliation snapshot math is correct and deterministic
 */

import { describe, it, expect } from 'vitest';
import {
  RedemptionMode,
  LoyaltyTransactionType,
  LoyaltyLedgerStatus,
  SimulatedLiabilityCategory,
  DataClassificationTier,
  isActiveHoldStatus,
  isReversibleStatus,
  deriveHoldStatus,
  validateRedemptionModeInput,
  validateIdempotencyKey,
  validateCertificateRef,
  computeReconciliationTotals,
} from '@voya/domain-model';
import { ok, notFound, validationFailure, isOk, isNotFound, isValidationFailure } from '../src/result.js';
import type { RepositoryResult } from '../src/result.js';
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
} from '../src/interfaces/simulated-loyalty-ledger-repository.js';
import {
  LOYALTY_OWNER_A,
  LOYALTY_OWNER_B,
  simulatedEarnQuoteInput,
  cashPlusPointsQuoteInput,
  certificateEligibilityQuoteInput,
  pointsAdvanceEligibleQuoteInput,
  standardHoldInput,
  makeCommitInput,
  makeValidReversalInput,
  makeOverReversalInput,
} from '@voya/test-fixtures';

// ---------------------------------------------------------------------------
// In-memory fake SimulatedLoyaltyLedgerRepository
// ---------------------------------------------------------------------------

let seq = 1;
function nextId(prefix: string): string {
  return `${prefix}_fake_${seq++}`;
}

class FakeLoyaltyLedgerRepository implements SimulatedLoyaltyLedgerRepository {
  private readonly quotes = new Map<string, LoyaltyQuoteRow>();
  private readonly quotesByKey = new Map<string, string>();
  private readonly holds = new Map<string, LoyaltyHoldRow>();
  private readonly holdsByKey = new Map<string, string>();
  private readonly entries: LoyaltyLedgerEntryRow[] = [];
  private readonly entriesByKey = new Map<string, LoyaltyLedgerEntryRow>();

  async createQuote(input: CreateQuoteInput): Promise<RepositoryResult<LoyaltyQuoteRow>> {
    const idErrors = validateIdempotencyKey(input.idempotencyKey);
    const modeErrors = validateRedemptionModeInput(input);
    if (idErrors.length || modeErrors.length) return validationFailure([...idErrors, ...modeErrors]);

    const existingId = this.quotesByKey.get(input.idempotencyKey);
    if (existingId) return ok(this.quotes.get(existingId)!);

    const row: LoyaltyQuoteRow = {
      id:                       nextId('quote'),
      ownerRef:                 input.ownerRef,
      itineraryRef:             input.itineraryRef ?? null,
      sourceLineRef:            input.sourceLineRef ?? null,
      redemptionMode:           input.redemptionMode,
      pointsAmount:             input.pointsAmount,
      cashAmountMinorUnits:     input.cashAmountMinorUnits ?? null,
      currencyCode:             input.currencyCode ?? null,
      certificateRef:           input.certificateRef ?? null,
      pointsAdvanceEligibility: input.pointsAdvanceEligibility ?? ('NOT_EVALUATED' as never),
      liabilityCategory:        input.liabilityCategory,
      simulated:                true,
      idempotencyKey:           input.idempotencyKey,
      dataClassification:       input.dataClassification ?? DataClassificationTier.INTERNAL,
      createdAt:                new Date(),
    };
    this.quotes.set(row.id, row);
    this.quotesByKey.set(input.idempotencyKey, row.id);
    return ok(row);
  }

  async placeHold(input: PlaceHoldInput): Promise<RepositoryResult<LoyaltyHoldRow>> {
    const idErrors = validateIdempotencyKey(input.idempotencyKey);
    const modeErrors = validateRedemptionModeInput(input);
    if (idErrors.length || modeErrors.length) return validationFailure([...idErrors, ...modeErrors]);

    const existingId = this.holdsByKey.get(input.idempotencyKey);
    if (existingId) return ok(this.holds.get(existingId)!);

    const row: LoyaltyHoldRow = {
      id:                   nextId('hold'),
      quoteId:              input.quoteId ?? null,
      ownerRef:             input.ownerRef,
      itineraryRef:         input.itineraryRef ?? null,
      sourceLineRef:        input.sourceLineRef ?? null,
      redemptionMode:       input.redemptionMode,
      pointsAmount:         input.pointsAmount,
      cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
      currencyCode:         input.currencyCode ?? null,
      simulated:            true,
      idempotencyKey:       input.idempotencyKey,
      expiresAt:            input.expiresAt ?? null,
      dataClassification:   input.dataClassification ?? DataClassificationTier.INTERNAL,
      createdAt:            new Date(),
    };
    this.holds.set(row.id, row);
    this.holdsByKey.set(input.idempotencyKey, row.id);

    this.appendEntry({
      holdId:               row.id,
      ownerRef:             row.ownerRef,
      itineraryRef:         row.itineraryRef,
      sourceLineRef:        row.sourceLineRef,
      transactionType:      LoyaltyTransactionType.HOLD,
      status:               LoyaltyLedgerStatus.HELD,
      redemptionMode:       row.redemptionMode,
      pointsAmount:         row.pointsAmount,
      cashAmountMinorUnits: row.cashAmountMinorUnits,
      currencyCode:         row.currencyCode,
      liabilityCategory:    SimulatedLiabilityCategory.ESTIMATED_EARN,
      idempotencyKey:       `${input.idempotencyKey}:hold`,
    });

    return ok(row);
  }

  async commitHold(input: CommitHoldInput): Promise<RepositoryResult<LoyaltyLedgerEntryRow>> {
    const idErrors = validateIdempotencyKey(input.idempotencyKey);
    if (idErrors.length) return validationFailure(idErrors);

    const existing = this.entriesByKey.get(input.idempotencyKey);
    if (existing) return ok(existing);

    const hold = this.holds.get(input.holdId);
    if (!hold || hold.ownerRef !== input.ownerRef) return notFound();

    const status = deriveHoldStatus(this.entriesFor(input.holdId));
    if (status === null || !isActiveHoldStatus(status)) {
      return validationFailure([`Hold "${input.holdId}" is not active (current status: ${status ?? 'UNKNOWN'}); cannot commit`]);
    }

    const pointsAmount = input.pointsAmount ?? hold.pointsAmount;
    if (pointsAmount > hold.pointsAmount) {
      return validationFailure([`commit pointsAmount ${pointsAmount} must not exceed the held amount ${hold.pointsAmount}`]);
    }

    const entry = this.appendEntry({
      holdId:               hold.id,
      ownerRef:             input.ownerRef,
      itineraryRef:         hold.itineraryRef,
      sourceLineRef:        hold.sourceLineRef,
      transactionType:      LoyaltyTransactionType.COMMIT,
      status:               LoyaltyLedgerStatus.COMMITTED,
      redemptionMode:       hold.redemptionMode,
      pointsAmount,
      cashAmountMinorUnits: input.cashAmountMinorUnits ?? hold.cashAmountMinorUnits,
      currencyCode:         hold.currencyCode,
      liabilityCategory:    input.liabilityCategory,
      idempotencyKey:       input.idempotencyKey,
    });
    return ok(entry);
  }

  async reverseHold(input: ReverseHoldInput): Promise<RepositoryResult<LoyaltyLedgerEntryRow>> {
    const idErrors = validateIdempotencyKey(input.idempotencyKey);
    if (idErrors.length) return validationFailure(idErrors);

    const existing = this.entriesByKey.get(input.idempotencyKey);
    if (existing) return ok(existing);

    const hold = this.holds.get(input.holdId);
    if (!hold || hold.ownerRef !== input.ownerRef) return notFound();

    const priorEntries = this.entriesFor(input.holdId);
    const status = deriveHoldStatus(priorEntries);
    if (status === null || !isReversibleStatus(status)) {
      return validationFailure([`Hold "${input.holdId}" is not reversible (current status: ${status ?? 'UNKNOWN'})`]);
    }

    const alreadyReversed = priorEntries
      .filter((e) => e.transactionType === LoyaltyTransactionType.REVERSAL)
      .reduce((sum, e) => sum + e.pointsAmount, 0);
    const remaining = hold.pointsAmount - alreadyReversed;
    if (input.pointsAmount > remaining) {
      return validationFailure([`reversal pointsAmount ${input.pointsAmount} exceeds the remaining held/committed amount ${remaining} for hold "${input.holdId}"`]);
    }

    const entry = this.appendEntry({
      holdId:               hold.id,
      ownerRef:             input.ownerRef,
      itineraryRef:         hold.itineraryRef,
      sourceLineRef:        hold.sourceLineRef,
      transactionType:      LoyaltyTransactionType.REVERSAL,
      status:               LoyaltyLedgerStatus.REVERSED,
      redemptionMode:       hold.redemptionMode,
      pointsAmount:         input.pointsAmount,
      cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
      currencyCode:         hold.currencyCode,
      liabilityCategory:    SimulatedLiabilityCategory.ADJUSTMENT,
      idempotencyKey:       input.idempotencyKey,
    });
    return ok(entry);
  }

  async appendAdjustment(input: AppendAdjustmentInput): Promise<RepositoryResult<LoyaltyLedgerEntryRow>> {
    const idErrors = validateIdempotencyKey(input.idempotencyKey);
    if (idErrors.length) return validationFailure(idErrors);

    const existing = this.entriesByKey.get(input.idempotencyKey);
    if (existing) return ok(existing);

    if (input.holdId) {
      const hold = this.holds.get(input.holdId);
      if (!hold || hold.ownerRef !== input.ownerRef) return notFound();
    }

    const entry = this.appendEntry({
      holdId:               input.holdId ?? null,
      ownerRef:             input.ownerRef,
      itineraryRef:         input.itineraryRef ?? null,
      sourceLineRef:        input.sourceLineRef ?? null,
      transactionType:      LoyaltyTransactionType.ADJUSTMENT,
      status:               LoyaltyLedgerStatus.ADJUSTED,
      redemptionMode:       input.redemptionMode,
      pointsAmount:         input.pointsAmount,
      cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
      currencyCode:         input.currencyCode ?? null,
      liabilityCategory:    input.liabilityCategory,
      idempotencyKey:       input.idempotencyKey,
    });
    return ok(entry);
  }

  async fetchLedgerByOwner(ownerRef: string): Promise<RepositoryResult<LoyaltyLedgerEntryRow[]>> {
    return ok(this.entries.filter((e) => e.ownerRef === ownerRef));
  }

  async fetchHoldStatus(holdId: string, ownerRef: string): Promise<RepositoryResult<LoyaltyLedgerStatus>> {
    const hold = this.holds.get(holdId);
    if (!hold || hold.ownerRef !== ownerRef) return notFound();
    const status = deriveHoldStatus(this.entriesFor(holdId));
    if (status === null) return notFound();
    return ok(status);
  }

  async generateReconciliationSnapshot(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RepositoryResult<LoyaltyReconciliationSnapshotRow>> {
    const inWindow = this.entries.filter((e) => e.createdAt >= periodStart && e.createdAt < periodEnd);
    const totals = computeReconciliationTotals(inWindow);
    return ok({
      id:                           nextId('snap'),
      periodStart,
      periodEnd,
      totalPointsHeld:              totals.totalPointsHeld,
      totalPointsCommitted:         totals.totalPointsCommitted,
      totalPointsReversed:          totals.totalPointsReversed,
      totalCashMinorUnitsCommitted: totals.totalCashMinorUnitsCommitted,
      currencyCode:                 inWindow.find((e) => e.currencyCode)?.currencyCode ?? null,
      simulated:                    true,
      dataClassification:           DataClassificationTier.INTERNAL,
      generatedAt:                  new Date(),
    });
  }

  private entriesFor(holdId: string): LoyaltyLedgerEntryRow[] {
    return this.entries.filter((e) => e.holdId === holdId);
  }

  private appendEntry(partial: Omit<LoyaltyLedgerEntryRow, 'id' | 'simulated' | 'dataClassification' | 'createdAt'>): LoyaltyLedgerEntryRow {
    const entry: LoyaltyLedgerEntryRow = {
      ...partial,
      id:                 nextId('entry'),
      simulated:          true,
      dataClassification: DataClassificationTier.INTERNAL,
      createdAt:          new Date(),
    };
    this.entries.push(entry);
    this.entriesByKey.set(entry.idempotencyKey, entry);
    return entry;
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('domain-model — redemption mode validation', () => {
  it('accepts a valid standard award-night input', () => {
    expect(validateRedemptionModeInput(simulatedEarnQuoteInput)).toHaveLength(0);
  });

  it('accepts a valid cash-plus-points input with both points and cash preserved', () => {
    expect(validateRedemptionModeInput(cashPlusPointsQuoteInput)).toHaveLength(0);
    expect(cashPlusPointsQuoteInput.pointsAmount).toBeGreaterThan(0);
    expect(cashPlusPointsQuoteInput.cashAmountMinorUnits).toBeGreaterThan(0);
  });

  it('rejects cash-plus-points missing cashAmountMinorUnits', () => {
    const errors = validateRedemptionModeInput({
      redemptionMode: RedemptionMode.CASH_PLUS_POINTS,
      pointsAmount:   1000,
      currencyCode:   'USD',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid certificate input with a synthetic certificateRef', () => {
    expect(validateRedemptionModeInput(certificateEligibilityQuoteInput)).toHaveLength(0);
    expect(validateCertificateRef(certificateEligibilityQuoteInput.certificateRef!)).toHaveLength(0);
  });

  it('rejects a non-synthetic certificateRef', () => {
    expect(validateCertificateRef('BONVOY-REAL-CERT-12345')).not.toHaveLength(0);
  });

  it('accepts a Points Advance input with evaluated eligibility', () => {
    expect(validateRedemptionModeInput(pointsAdvanceEligibleQuoteInput)).toHaveLength(0);
  });

  it('rejects Points Advance with NOT_EVALUATED eligibility', () => {
    const errors = validateRedemptionModeInput({
      redemptionMode: RedemptionMode.POINTS_ADVANCE,
      pointsAmount:   1000,
    });
    expect(errors.some((e) => e.includes('evaluated'))).toBe(true);
  });
});

describe('domain-model — lifecycle status helpers', () => {
  it('isActiveHoldStatus is true only for HELD', () => {
    expect(isActiveHoldStatus(LoyaltyLedgerStatus.HELD)).toBe(true);
    expect(isActiveHoldStatus(LoyaltyLedgerStatus.COMMITTED)).toBe(false);
    expect(isActiveHoldStatus(LoyaltyLedgerStatus.REVERSED)).toBe(false);
  });

  it('isReversibleStatus is true for HELD and COMMITTED', () => {
    expect(isReversibleStatus(LoyaltyLedgerStatus.HELD)).toBe(true);
    expect(isReversibleStatus(LoyaltyLedgerStatus.COMMITTED)).toBe(true);
    expect(isReversibleStatus(LoyaltyLedgerStatus.REVERSED)).toBe(false);
  });

  it('deriveHoldStatus returns null for an empty entry list', () => {
    expect(deriveHoldStatus([])).toBeNull();
  });

  it('deriveHoldStatus returns the most recent entry status', () => {
    const entries = [
      { status: LoyaltyLedgerStatus.HELD },
      { status: LoyaltyLedgerStatus.COMMITTED },
    ];
    expect(deriveHoldStatus(entries)).toBe(LoyaltyLedgerStatus.COMMITTED);
  });
});

describe('domain-model — computeReconciliationTotals', () => {
  it('sums HOLD, COMMIT, and REVERSAL entries independently', () => {
    const totals = computeReconciliationTotals([
      { transactionType: LoyaltyTransactionType.HOLD, pointsAmount: 45000, cashAmountMinorUnits: null },
      { transactionType: LoyaltyTransactionType.COMMIT, pointsAmount: 45000, cashAmountMinorUnits: 15000 },
      { transactionType: LoyaltyTransactionType.REVERSAL, pointsAmount: 10000, cashAmountMinorUnits: null },
      { transactionType: LoyaltyTransactionType.QUOTE, pointsAmount: 99999, cashAmountMinorUnits: null },
    ]);
    expect(totals.totalPointsHeld).toBe(45000);
    expect(totals.totalPointsCommitted).toBe(45000);
    expect(totals.totalPointsReversed).toBe(10000);
    expect(totals.totalCashMinorUnitsCommitted).toBe(15000);
  });

  it('returns all zeros for an empty entry list', () => {
    const totals = computeReconciliationTotals([]);
    expect(totals).toEqual({
      totalPointsHeld: 0,
      totalPointsCommitted: 0,
      totalPointsReversed: 0,
      totalCashMinorUnitsCommitted: 0,
    });
  });
});

describe('SimulatedLoyaltyLedgerRepository — createQuote', () => {
  it('creates a quote with simulated=true', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const result = await repo.createQuote(simulatedEarnQuoteInput);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.data.simulated).toBe(true);
  });

  it('replays the original quote on duplicate idempotencyKey', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const first = await repo.createQuote(simulatedEarnQuoteInput);
    const second = await repo.createQuote(simulatedEarnQuoteInput);
    expect(isOk(first)).toBe(true);
    expect(isOk(second)).toBe(true);
    if (isOk(first) && isOk(second)) expect(first.data.id).toBe(second.data.id);
  });
});

describe('SimulatedLoyaltyLedgerRepository — placeHold and commitHold', () => {
  it('places a hold and derives HELD status', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    expect(isOk(hold)).toBe(true);
    if (!isOk(hold)) return;

    const status = await repo.fetchHoldStatus(hold.data.id, LOYALTY_OWNER_A);
    expect(isOk(status)).toBe(true);
    if (isOk(status)) expect(status.data).toBe(LoyaltyLedgerStatus.HELD);
  });

  it('commitHold succeeds for an active hold and derives COMMITTED status', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;

    const commit = await repo.commitHold(makeCommitInput(hold.data.id));
    expect(isOk(commit)).toBe(true);

    const status = await repo.fetchHoldStatus(hold.data.id, LOYALTY_OWNER_A);
    if (isOk(status)) expect(status.data).toBe(LoyaltyLedgerStatus.COMMITTED);
  });

  it('commitHold returns NOT_FOUND for a cross-owner attempt', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;

    const commit = await repo.commitHold({ ...makeCommitInput(hold.data.id, LOYALTY_OWNER_B) });
    expect(isNotFound(commit)).toBe(true);
  });

  it('commitHold returns VALIDATION_FAILURE when the hold is already committed', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;

    await repo.commitHold(makeCommitInput(hold.data.id));
    const secondAttempt = await repo.commitHold({
      ...makeCommitInput(hold.data.id),
      idempotencyKey: 'idem_commit_second_attempt_00001',
    });
    expect(isValidationFailure(secondAttempt)).toBe(true);
  });

  it('duplicate commit idempotencyKey replays the original entry', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;

    const first = await repo.commitHold(makeCommitInput(hold.data.id));
    const second = await repo.commitHold(makeCommitInput(hold.data.id));
    expect(isOk(first)).toBe(true);
    expect(isOk(second)).toBe(true);
    if (isOk(first) && isOk(second)) expect(first.data.id).toBe(second.data.id);
  });
});

describe('SimulatedLoyaltyLedgerRepository — reverseHold', () => {
  it('reverses a committed hold within the committed amount', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;
    await repo.commitHold(makeCommitInput(hold.data.id));

    const reversal = await repo.reverseHold(makeValidReversalInput(hold.data.id));
    expect(isOk(reversal)).toBe(true);
    if (isOk(reversal)) {
      expect(reversal.data.transactionType).toBe(LoyaltyTransactionType.REVERSAL);
      expect(reversal.data.simulated).toBe(true);
    }
  });

  it('rejects a reversal that exceeds the held/committed amount', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;

    const overReversal = await repo.reverseHold(makeOverReversalInput(hold.data.id));
    expect(isValidationFailure(overReversal)).toBe(true);
    if (isValidationFailure(overReversal)) {
      expect(overReversal.errors.some((e) => e.includes('exceeds'))).toBe(true);
    }
  });

  it('rejects reversing a hold that has no entries under an unknown id', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const result = await repo.reverseHold(makeValidReversalInput('hold_never_existed', LOYALTY_OWNER_A));
    expect(isNotFound(result)).toBe(true);
  });

  it('a second reversal exceeding the remaining amount after a partial reversal is rejected', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;
    await repo.commitHold(makeCommitInput(hold.data.id));

    const partial = await repo.reverseHold({
      holdId: hold.data.id, ownerRef: LOYALTY_OWNER_A,
      idempotencyKey: 'idem_reversal_partial_test_00001', pointsAmount: 20000,
    });
    expect(isOk(partial)).toBe(true);

    const secondReversal = await repo.reverseHold({
      holdId: hold.data.id, ownerRef: LOYALTY_OWNER_A,
      idempotencyKey: 'idem_reversal_partial_test_00002', pointsAmount: 30000, // 20000 + 30000 > 45000 held
    });
    expect(isValidationFailure(secondReversal)).toBe(true);
  });
});

describe('SimulatedLoyaltyLedgerRepository — append-only enforcement', () => {
  it('the interface exposes no update or delete methods', () => {
    const repo = new FakeLoyaltyLedgerRepository();
    expect('update' in repo).toBe(false);
    expect('delete' in repo).toBe(false);
    expect('updateHold' in repo).toBe(false);
    expect('deleteLedgerEntry' in repo).toBe(false);
  });

  it('every appended ledger entry carries simulated=true', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;
    await repo.commitHold(makeCommitInput(hold.data.id));

    const ledger = await repo.fetchLedgerByOwner(LOYALTY_OWNER_A);
    expect(isOk(ledger)).toBe(true);
    if (isOk(ledger)) {
      expect(ledger.data.length).toBeGreaterThan(0);
      expect(ledger.data.every((e) => e.simulated === true)).toBe(true);
    }
  });
});

describe('SimulatedLoyaltyLedgerRepository — generateReconciliationSnapshot', () => {
  it('computes totals for entries within the period and labels the snapshot simulated', async () => {
    const repo = new FakeLoyaltyLedgerRepository();
    const hold = await repo.placeHold(standardHoldInput);
    if (!isOk(hold)) return;
    await repo.commitHold(makeCommitInput(hold.data.id));

    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const snapshot = await repo.generateReconciliationSnapshot(past, future);
    expect(isOk(snapshot)).toBe(true);
    if (isOk(snapshot)) {
      expect(snapshot.data.simulated).toBe(true);
      expect(snapshot.data.totalPointsHeld).toBe(45000);
      expect(snapshot.data.totalPointsCommitted).toBe(45000);
    }
  });
});
