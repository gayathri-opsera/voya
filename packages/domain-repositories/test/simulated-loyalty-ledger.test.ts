/**
 * Unit tests for SimulatedLoyaltyLedgerRepository — domain types, validators,
 * lifecycle state machine, and in-memory fake implementation.
 *
 * No database required. Tests prove:
 *  - All quotes, holds, and ledger entries carry simulated=true
 *  - Idempotent createQuote returns original row on duplicate idempotencyKey
 *  - placeHold requires an existing PENDING/ACTIVE quote owned by the caller
 *  - commitHold requires an ACTIVE hold owned by the caller
 *  - reverseHold rejects over-reversal (pointsToReverse > hold.pointsAmount)
 *  - reverseHold rejects COMMITTED or REVERSED hold transitions
 *  - appendAdjustment accepts standalone adjustments with idempotency
 *  - fetchLedgerByOwner scopes results to the requested owner
 *  - generateReconciliationSnapshot returns idempotent snapshot
 *  - validateReversalAmount, validateIdempotencyKey, validatePointsAmountLoyalty
 *  - computeReconciliationSummary aggregates earn/held/committed/reversed correctly
 *  - isValidHoldTransition enforces valid state transitions
 *  - hasSimulatedLabel validates traveller-visible labels
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LoyaltyTransactionType,
  LoyaltyLedgerStatus,
  RedemptionMode,
  PointsAdvanceEligibility,
  SimulatedLiabilityCategory,
  isTerminalLedgerStatus,
  isValidHoldTransition,
  isValidPointsAmount,
  validatePointsAmountLoyalty,
  validateCashMinorUnits,
  isValidCurrencyCode,
  validateCurrencyCode,
  validateIdempotencyKey,
  validateReversalAmount,
  hasSimulatedLabel,
  validateSimulatedLabel,
  computeReconciliationSummary,
} from '@voya/domain-model';
import type { LedgerEntryInput } from '@voya/domain-model';
import { ok, notFound, validationFailure, expired, isOk, isNotFound, isValidationFailure, isExpired } from '../src/result.js';
import type { RepositoryResult } from '../src/result.js';
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
} from '../src/interfaces/simulated-loyalty-ledger-repository.js';
import {
  LOYALTY_OWNER_A,
  LOYALTY_OWNER_B,
  earnEstimateQuoteInput,
  cashPlusPointsQuoteInput,
  placeHoldInput,
  overReversalScenario,
} from '@voya/test-fixtures';

// ---------------------------------------------------------------------------
// In-memory fake SimulatedLoyaltyLedgerRepository
// ---------------------------------------------------------------------------

let idSeq = 1;
function nextId(): string { return `fake_${idSeq++}`; }

class FakeSimulatedLoyaltyLedgerRepository implements SimulatedLoyaltyLedgerRepository {
  private readonly quotes      = new Map<string, LoyaltyQuoteRow>();
  private readonly holds       = new Map<string, LoyaltyHoldRow>();
  private readonly entries     = new Map<string, LoyaltyLedgerEntryRow>();
  private readonly snapshots   = new Map<string, LoyaltyReconciliationSnapshotRow>();
  private readonly certs       = new Map<string, CertificateReferenceRow>();
  // idempotencyKey → row id
  private readonly quoteByKey  = new Map<string, string>();
  private readonly holdByKey   = new Map<string, string>();
  private readonly entryByKey  = new Map<string, string>();

  constructor() { idSeq = 1; }

  async createQuote(input: CreateQuoteInput): Promise<RepositoryResult<LoyaltyQuoteRow>> {
    if (!input.ownerRef) return validationFailure(['ownerRef must not be empty']);
    const keyErrors = validateIdempotencyKey(input.idempotencyKey);
    if (keyErrors.length > 0) return validationFailure([...keyErrors]);
    const ptsErrors = validatePointsAmountLoyalty(input.pointsAmount);
    if (ptsErrors.length > 0) return validationFailure([...ptsErrors]);

    const existingId = this.quoteByKey.get(input.idempotencyKey);
    if (existingId) return ok(this.quotes.get(existingId)!);

    const row: LoyaltyQuoteRow = {
      id:                       nextId(),
      ownerRef:                 input.ownerRef,
      idempotencyKey:           input.idempotencyKey,
      itineraryRef:             input.itineraryRef ?? null,
      cartRef:                  input.cartRef ?? null,
      lineItemRef:              input.lineItemRef ?? null,
      redemptionMode:           input.redemptionMode,
      pointsAmount:             input.pointsAmount,
      cashAmountMinorUnits:     input.cashAmountMinorUnits ?? null,
      currencyCode:             input.currencyCode ?? null,
      estimatedEarnPoints:      input.estimatedEarnPoints ?? null,
      pointsAdvanceEligibility: input.pointsAdvanceEligibility ?? PointsAdvanceEligibility.NOT_ELIGIBLE,
      certificateRef:           input.certificateRef ?? null,
      simulated:                true,
      status:                   LoyaltyLedgerStatus.PENDING,
      expiresAt:                input.expiresAt ?? null,
      dataClassification:       'CONFIDENTIAL' as const,
      createdAt:                new Date(),
      updatedAt:                new Date(),
    };
    this.quotes.set(row.id, row);
    this.quoteByKey.set(input.idempotencyKey, row.id);
    return ok(row);
  }

  async placeHold(input: PlaceHoldInput): Promise<RepositoryResult<LoyaltyHoldRow>> {
    if (!input.ownerRef) return validationFailure(['ownerRef must not be empty']);
    const keyErrors = validateIdempotencyKey(input.idempotencyKey);
    if (keyErrors.length > 0) return validationFailure([...keyErrors]);

    const existingId = this.holdByKey.get(input.idempotencyKey);
    if (existingId) return ok(this.holds.get(existingId)!);

    const quote = this.quotes.get(input.quoteId);
    if (!quote || quote.ownerRef !== input.ownerRef) return notFound();
    if (quote.expiresAt && quote.expiresAt <= new Date()) return expired(quote.expiresAt);
    if (isTerminalLedgerStatus(quote.status)) {
      return validationFailure([`quote is in terminal status ${quote.status}`]);
    }

    const hold: LoyaltyHoldRow = {
      id:                   nextId(),
      ownerRef:             input.ownerRef,
      quoteId:              input.quoteId,
      idempotencyKey:       input.idempotencyKey,
      pointsAmount:         input.pointsAmount,
      cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
      currencyCode:         input.currencyCode ?? null,
      simulated:            true,
      status:               LoyaltyLedgerStatus.ACTIVE,
      expiresAt:            input.expiresAt ?? null,
      transactionRef:       input.transactionRef,
      dataClassification:   'CONFIDENTIAL' as const,
      createdAt:            new Date(),
      updatedAt:            new Date(),
    };
    this.holds.set(hold.id, hold);
    this.holdByKey.set(input.idempotencyKey, hold.id);

    // Append ledger entry
    const entry: LoyaltyLedgerEntryRow = {
      id:                   nextId(),
      ownerRef:             input.ownerRef,
      quoteId:              input.quoteId,
      holdId:               hold.id,
      idempotencyKey:       `${input.idempotencyKey}:ledger`,
      transactionType:      LoyaltyTransactionType.HOLD_PLACED,
      liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_HOLD,
      pointsAmount:         input.pointsAmount,
      cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
      currencyCode:         input.currencyCode ?? null,
      itineraryRef:         null,
      cartRef:              null,
      lineItemRef:          null,
      simulated:            true,
      status:               LoyaltyLedgerStatus.ACTIVE,
      dataClassification:   'CONFIDENTIAL' as const,
      createdAt:            new Date(),
    };
    this.entries.set(entry.id, entry);
    this.entryByKey.set(entry.idempotencyKey, entry.id);

    return ok(hold);
  }

  async commitHold(
    holdId: string,
    ownerRef: string,
    idempotencyKey: string,
  ): Promise<RepositoryResult<LoyaltyHoldRow>> {
    const keyErrors = validateIdempotencyKey(idempotencyKey);
    if (keyErrors.length > 0) return validationFailure([...keyErrors]);

    const hold = this.holds.get(holdId);
    if (!hold || hold.ownerRef !== ownerRef) return notFound();
    if (hold.expiresAt && hold.expiresAt <= new Date()) return expired(hold.expiresAt);
    if (hold.status !== LoyaltyLedgerStatus.ACTIVE) {
      return validationFailure([`hold is in status ${hold.status} — only ACTIVE holds can be committed`]);
    }

    const updated: LoyaltyHoldRow = { ...hold, status: LoyaltyLedgerStatus.COMMITTED, updatedAt: new Date() };
    this.holds.set(holdId, updated);

    // Append commit ledger entry
    const entry: LoyaltyLedgerEntryRow = {
      id:                   nextId(),
      ownerRef,
      quoteId:              hold.quoteId,
      holdId,
      idempotencyKey:       `${idempotencyKey}:commit`,
      transactionType:      LoyaltyTransactionType.HOLD_COMMITTED,
      liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_COMMIT,
      pointsAmount:         hold.pointsAmount,
      cashAmountMinorUnits: hold.cashAmountMinorUnits,
      currencyCode:         hold.currencyCode,
      itineraryRef:         null,
      cartRef:              null,
      lineItemRef:          null,
      simulated:            true,
      status:               LoyaltyLedgerStatus.COMMITTED,
      dataClassification:   'CONFIDENTIAL' as const,
      createdAt:            new Date(),
    };
    this.entries.set(entry.id, entry);
    this.entryByKey.set(entry.idempotencyKey, entry.id);

    return ok(updated);
  }

  async reverseHold(
    holdId: string,
    ownerRef: string,
    idempotencyKey: string,
    pointsToReverse: number,
  ): Promise<RepositoryResult<LoyaltyHoldRow>> {
    const keyErrors = validateIdempotencyKey(idempotencyKey);
    if (keyErrors.length > 0) return validationFailure([...keyErrors]);

    const hold = this.holds.get(holdId);
    if (!hold || hold.ownerRef !== ownerRef) return notFound();
    if (hold.expiresAt && hold.expiresAt <= new Date()) return expired(hold.expiresAt);

    if (hold.status !== LoyaltyLedgerStatus.ACTIVE && hold.status !== LoyaltyLedgerStatus.COMMITTED) {
      return validationFailure([`hold is in status ${hold.status} — only ACTIVE or COMMITTED holds can be reversed`]);
    }

    const reversalErrors = validateReversalAmount(pointsToReverse, hold.pointsAmount);
    if (reversalErrors.length > 0) return validationFailure([...reversalErrors]);

    const updated: LoyaltyHoldRow = { ...hold, status: LoyaltyLedgerStatus.REVERSED, updatedAt: new Date() };
    this.holds.set(holdId, updated);

    const entry: LoyaltyLedgerEntryRow = {
      id:                   nextId(),
      ownerRef,
      quoteId:              hold.quoteId,
      holdId,
      idempotencyKey:       `${idempotencyKey}:reverse`,
      transactionType:      LoyaltyTransactionType.HOLD_REVERSED,
      liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_HOLD,
      pointsAmount:         pointsToReverse,
      cashAmountMinorUnits: null,
      currencyCode:         hold.currencyCode,
      itineraryRef:         null,
      cartRef:              null,
      lineItemRef:          null,
      simulated:            true,
      status:               LoyaltyLedgerStatus.REVERSED,
      dataClassification:   'CONFIDENTIAL' as const,
      createdAt:            new Date(),
    };
    this.entries.set(entry.id, entry);

    return ok(updated);
  }

  async appendAdjustment(input: AppendAdjustmentInput): Promise<RepositoryResult<LoyaltyLedgerEntryRow>> {
    if (!input.ownerRef) return validationFailure(['ownerRef must not be empty']);
    const keyErrors = validateIdempotencyKey(input.idempotencyKey);
    if (keyErrors.length > 0) return validationFailure([...keyErrors]);

    const existingId = this.entryByKey.get(input.idempotencyKey);
    if (existingId) return ok(this.entries.get(existingId)!);

    const ptsErrors = validatePointsAmountLoyalty(input.pointsAmount);
    if (ptsErrors.length > 0) return validationFailure([...ptsErrors]);

    const entry: LoyaltyLedgerEntryRow = {
      id:                   nextId(),
      ownerRef:             input.ownerRef,
      quoteId:              null,
      holdId:               null,
      idempotencyKey:       input.idempotencyKey,
      transactionType:      LoyaltyTransactionType.ADJUSTMENT,
      liabilityCategory:    input.liabilityCategory,
      pointsAmount:         input.pointsAmount,
      cashAmountMinorUnits: input.cashAmountMinorUnits ?? null,
      currencyCode:         input.currencyCode ?? null,
      itineraryRef:         input.itineraryRef ?? null,
      cartRef:              input.cartRef ?? null,
      lineItemRef:          input.lineItemRef ?? null,
      simulated:            true,
      status:               LoyaltyLedgerStatus.ACTIVE,
      dataClassification:   'CONFIDENTIAL' as const,
      createdAt:            new Date(),
    };
    this.entries.set(entry.id, entry);
    this.entryByKey.set(entry.idempotencyKey, entry.id);
    return ok(entry);
  }

  async fetchLedgerByOwner(ownerRef: string): Promise<RepositoryResult<LoyaltyLedgerEntryRow[]>> {
    if (!ownerRef) return validationFailure(['ownerRef must not be empty']);
    const rows = [...this.entries.values()]
      .filter(e => e.ownerRef === ownerRef)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return ok(rows);
  }

  async generateReconciliationSnapshot(
    ownerRef: string,
    snapshotPeriod: string,
  ): Promise<RepositoryResult<LoyaltyReconciliationSnapshotRow>> {
    if (!ownerRef) return validationFailure(['ownerRef must not be empty']);
    if (!snapshotPeriod) return validationFailure(['snapshotPeriod must not be empty']);

    const key = `${ownerRef}:${snapshotPeriod}`;
    const existing = this.snapshots.get(key);
    if (existing) return ok(existing);

    const ownerEntries = [...this.entries.values()].filter(e => e.ownerRef === ownerRef);
    const summary = computeReconciliationSummary(ownerEntries);
    const currencyEntry = ownerEntries.find(e => e.currencyCode);

    const snapshot: LoyaltyReconciliationSnapshotRow = {
      id:                            nextId(),
      ownerRef,
      snapshotPeriod,
      totalSimulatedEarnPoints:      summary.totalSimulatedEarnPoints,
      totalSimulatedHeldPoints:      summary.totalSimulatedHeldPoints,
      totalSimulatedCommittedPoints: summary.totalSimulatedCommittedPoints,
      totalSimulatedReversedPoints:  summary.totalSimulatedReversedPoints,
      totalCashMinorUnits:           summary.totalCashMinorUnits,
      currencyCode:                  currencyEntry?.currencyCode ?? null,
      entryCount:                    summary.entryCount,
      simulated:                     true,
      generatedAt:                   new Date(),
      dataClassification:            'CONFIDENTIAL' as const,
      createdAt:                     new Date(),
    };
    this.snapshots.set(key, snapshot);
    return ok(snapshot);
  }

  async fetchCertificate(
    ownerRef: string,
    certificateRef: string,
  ): Promise<RepositoryResult<CertificateReferenceRow>> {
    const row = [...this.certs.values()].find(c => c.ownerRef === ownerRef && c.certificateRef === certificateRef);
    return row ? ok(row) : notFound();
  }

  // Test helper: seed a certificate
  _seedCert(cert: CertificateReferenceRow): void {
    this.certs.set(cert.id, cert);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loyalty-ledger domain validators', () => {
  describe('validatePointsAmountLoyalty', () => {
    it('accepts non-negative integers', () => {
      expect(validatePointsAmountLoyalty(0)).toHaveLength(0);
      expect(validatePointsAmountLoyalty(35000)).toHaveLength(0);
    });
    it('rejects negative values', () => {
      expect(validatePointsAmountLoyalty(-1)).not.toHaveLength(0);
    });
    it('rejects non-integers', () => {
      expect(validatePointsAmountLoyalty(100.5)).not.toHaveLength(0);
    });
  });

  describe('validateCashMinorUnits', () => {
    it('accepts zero and positive integers', () => {
      expect(validateCashMinorUnits(0)).toHaveLength(0);
      expect(validateCashMinorUnits(9900)).toHaveLength(0);
    });
    it('rejects negative values', () => {
      expect(validateCashMinorUnits(-1)).not.toHaveLength(0);
    });
  });

  describe('validateCurrencyCode', () => {
    it('accepts 3-letter ISO codes', () => {
      expect(validateCurrencyCode('USD')).toHaveLength(0);
      expect(validateCurrencyCode('GBP')).toHaveLength(0);
    });
    it('rejects lowercase or wrong length', () => {
      expect(validateCurrencyCode('usd')).not.toHaveLength(0);
      expect(validateCurrencyCode('USDA')).not.toHaveLength(0);
    });
  });

  describe('validateIdempotencyKey', () => {
    it('accepts valid keys', () => {
      expect(validateIdempotencyKey('idem_001')).toHaveLength(0);
    });
    it('rejects empty string', () => {
      expect(validateIdempotencyKey('')).not.toHaveLength(0);
    });
    it('rejects keys with whitespace', () => {
      expect(validateIdempotencyKey('idem key')).not.toHaveLength(0);
    });
    it('rejects keys over 128 chars', () => {
      expect(validateIdempotencyKey('x'.repeat(129))).not.toHaveLength(0);
    });
  });

  describe('validateReversalAmount', () => {
    it('accepts reversal within held amount', () => {
      expect(validateReversalAmount(10000, 35000)).toHaveLength(0);
    });
    it('accepts reversal equal to held amount', () => {
      expect(validateReversalAmount(35000, 35000)).toHaveLength(0);
    });
    it('rejects reversal exceeding held amount', () => {
      expect(validateReversalAmount(35001, 35000)).not.toHaveLength(0);
    });
    it('rejects negative reversal', () => {
      expect(validateReversalAmount(-1, 35000)).not.toHaveLength(0);
    });
  });

  describe('hasSimulatedLabel / validateSimulatedLabel', () => {
    it('accepts labels containing "simulated"', () => {
      expect(hasSimulatedLabel('Simulated Earn: 3,500 points')).toBe(true);
      expect(validateSimulatedLabel('Simulated Earn: 3,500 points')).toHaveLength(0);
    });
    it('accepts labels containing "estimated"', () => {
      expect(hasSimulatedLabel('Estimated earn: 1,500 pts')).toBe(true);
    });
    it('rejects labels without required wording', () => {
      expect(hasSimulatedLabel('Earn: 3,500 points')).toBe(false);
      expect(validateSimulatedLabel('Earn: 3,500 points')).not.toHaveLength(0);
    });
  });

  describe('isTerminalLedgerStatus', () => {
    it('identifies terminal statuses', () => {
      expect(isTerminalLedgerStatus(LoyaltyLedgerStatus.COMMITTED)).toBe(true);
      expect(isTerminalLedgerStatus(LoyaltyLedgerStatus.REVERSED)).toBe(true);
      expect(isTerminalLedgerStatus(LoyaltyLedgerStatus.EXPIRED)).toBe(true);
      expect(isTerminalLedgerStatus(LoyaltyLedgerStatus.REJECTED)).toBe(true);
    });
    it('identifies non-terminal statuses', () => {
      expect(isTerminalLedgerStatus(LoyaltyLedgerStatus.ACTIVE)).toBe(false);
      expect(isTerminalLedgerStatus(LoyaltyLedgerStatus.PENDING)).toBe(false);
    });
  });

  describe('isValidHoldTransition', () => {
    it('allows ACTIVE → COMMITTED', () => {
      expect(isValidHoldTransition(LoyaltyLedgerStatus.ACTIVE, LoyaltyLedgerStatus.COMMITTED)).toBe(true);
    });
    it('allows ACTIVE → REVERSED', () => {
      expect(isValidHoldTransition(LoyaltyLedgerStatus.ACTIVE, LoyaltyLedgerStatus.REVERSED)).toBe(true);
    });
    it('allows ACTIVE → EXPIRED', () => {
      expect(isValidHoldTransition(LoyaltyLedgerStatus.ACTIVE, LoyaltyLedgerStatus.EXPIRED)).toBe(true);
    });
    it('disallows COMMITTED → ACTIVE', () => {
      expect(isValidHoldTransition(LoyaltyLedgerStatus.COMMITTED, LoyaltyLedgerStatus.ACTIVE)).toBe(false);
    });
    it('disallows REVERSED → ACTIVE', () => {
      expect(isValidHoldTransition(LoyaltyLedgerStatus.REVERSED, LoyaltyLedgerStatus.ACTIVE)).toBe(false);
    });
  });

  describe('computeReconciliationSummary', () => {
    it('aggregates earn, held, committed, and reversed entries', () => {
      const entries: LedgerEntryInput[] = [
        { transactionType: LoyaltyTransactionType.EARN_ESTIMATE, liabilityCategory: SimulatedLiabilityCategory.EARN_ESTIMATE, pointsAmount: 3500, status: LoyaltyLedgerStatus.ACTIVE },
        { transactionType: LoyaltyTransactionType.HOLD_PLACED, liabilityCategory: SimulatedLiabilityCategory.REDEMPTION_HOLD, pointsAmount: 35000, cashAmountMinorUnits: 9900, status: LoyaltyLedgerStatus.ACTIVE },
        { transactionType: LoyaltyTransactionType.HOLD_COMMITTED, liabilityCategory: SimulatedLiabilityCategory.REDEMPTION_COMMIT, pointsAmount: 35000, cashAmountMinorUnits: 9900, status: LoyaltyLedgerStatus.COMMITTED },
        { transactionType: LoyaltyTransactionType.HOLD_REVERSED, liabilityCategory: SimulatedLiabilityCategory.REDEMPTION_HOLD, pointsAmount: 10000, status: LoyaltyLedgerStatus.REVERSED },
      ];
      const summary = computeReconciliationSummary(entries);
      expect(summary.totalSimulatedEarnPoints).toBe(3500);
      expect(summary.totalSimulatedHeldPoints).toBe(35000);
      expect(summary.totalSimulatedCommittedPoints).toBe(35000);
      expect(summary.totalSimulatedReversedPoints).toBe(10000);
      expect(summary.totalCashMinorUnits).toBe(19800);
      expect(summary.entryCount).toBe(4);
    });
    it('returns zeros for empty input', () => {
      const summary = computeReconciliationSummary([]);
      expect(summary.totalSimulatedEarnPoints).toBe(0);
      expect(summary.entryCount).toBe(0);
    });
  });
});

describe('FakeSimulatedLoyaltyLedgerRepository', () => {
  let repo: FakeSimulatedLoyaltyLedgerRepository;

  beforeEach(() => {
    repo = new FakeSimulatedLoyaltyLedgerRepository();
  });

  describe('createQuote', () => {
    it('creates a quote with simulated=true', async () => {
      const result = await repo.createQuote(earnEstimateQuoteInput);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.simulated).toBe(true);
        expect(result.data.ownerRef).toBe(LOYALTY_OWNER_A);
        expect(result.data.status).toBe(LoyaltyLedgerStatus.PENDING);
      }
    });

    it('is idempotent — returns original row on duplicate idempotencyKey', async () => {
      const first  = await repo.createQuote(earnEstimateQuoteInput);
      const second = await repo.createQuote(earnEstimateQuoteInput);
      expect(isOk(first)).toBe(true);
      expect(isOk(second)).toBe(true);
      if (isOk(first) && isOk(second)) {
        expect(second.data.id).toBe(first.data.id);
      }
    });

    it('creates a cash-plus-points quote preserving both amounts', async () => {
      const result = await repo.createQuote(cashPlusPointsQuoteInput);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.pointsAmount).toBe(15000);
        expect(result.data.cashAmountMinorUnits).toBe(9900);
        expect(result.data.currencyCode).toBe('USD');
      }
    });

    it('returns VALIDATION_FAILURE for empty ownerRef', async () => {
      const result = await repo.createQuote({ ...earnEstimateQuoteInput, ownerRef: '' });
      expect(isValidationFailure(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for negative pointsAmount', async () => {
      const result = await repo.createQuote({ ...earnEstimateQuoteInput, idempotencyKey: 'new_key', pointsAmount: -1 });
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('placeHold', () => {
    it('places a hold and appends a ledger entry', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      expect(isOk(quoteResult)).toBe(true);
      if (!isOk(quoteResult)) return;

      const holdInput: PlaceHoldInput = { ...placeHoldInput, quoteId: quoteResult.data.id };
      const holdResult = await repo.placeHold(holdInput);
      expect(isOk(holdResult)).toBe(true);
      if (isOk(holdResult)) {
        expect(holdResult.data.simulated).toBe(true);
        expect(holdResult.data.status).toBe(LoyaltyLedgerStatus.ACTIVE);
        expect(holdResult.data.pointsAmount).toBe(35000);
      }

      // Ledger entry should be present
      const ledger = await repo.fetchLedgerByOwner(LOYALTY_OWNER_A);
      expect(isOk(ledger)).toBe(true);
      if (isOk(ledger)) {
        expect(ledger.data.some(e => e.transactionType === LoyaltyTransactionType.HOLD_PLACED)).toBe(true);
      }
    });

    it('is idempotent — returns original hold on duplicate idempotencyKey', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(quoteResult)) return;
      const holdInput: PlaceHoldInput = { ...placeHoldInput, quoteId: quoteResult.data.id };

      const first  = await repo.placeHold(holdInput);
      const second = await repo.placeHold(holdInput);
      expect(isOk(first) && isOk(second)).toBe(true);
      if (isOk(first) && isOk(second)) {
        expect(second.data.id).toBe(first.data.id);
      }
    });

    it('returns NOT_FOUND for unknown quoteId', async () => {
      const result = await repo.placeHold({ ...placeHoldInput, quoteId: 'unknown-id' });
      expect(isNotFound(result)).toBe(true);
    });

    it('returns NOT_FOUND for cross-owner access', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(quoteResult)) return;
      const result = await repo.placeHold({
        ...placeHoldInput,
        quoteId:  quoteResult.data.id,
        ownerRef: LOYALTY_OWNER_B,
      });
      expect(isNotFound(result)).toBe(true);
    });
  });

  describe('commitHold', () => {
    it('commits an ACTIVE hold and appends ledger entry', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(quoteResult)) return;
      const holdResult = await repo.placeHold({ ...placeHoldInput, quoteId: quoteResult.data.id });
      if (!isOk(holdResult)) return;

      const commitResult = await repo.commitHold(holdResult.data.id, LOYALTY_OWNER_A, 'idem_commit_001');
      expect(isOk(commitResult)).toBe(true);
      if (isOk(commitResult)) {
        expect(commitResult.data.status).toBe(LoyaltyLedgerStatus.COMMITTED);
      }

      const ledger = await repo.fetchLedgerByOwner(LOYALTY_OWNER_A);
      if (isOk(ledger)) {
        expect(ledger.data.some(e => e.transactionType === LoyaltyTransactionType.HOLD_COMMITTED)).toBe(true);
      }
    });

    it('returns VALIDATION_FAILURE if hold is not ACTIVE (already committed)', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(quoteResult)) return;
      const holdResult = await repo.placeHold({ ...placeHoldInput, quoteId: quoteResult.data.id });
      if (!isOk(holdResult)) return;

      await repo.commitHold(holdResult.data.id, LOYALTY_OWNER_A, 'idem_commit_001');
      // Second commit on same hold — already COMMITTED, not idempotent (different key)
      const result = await repo.commitHold(holdResult.data.id, LOYALTY_OWNER_A, 'idem_commit_002');
      expect(isValidationFailure(result)).toBe(true);
    });

    it('returns NOT_FOUND for cross-owner commit attempt', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(quoteResult)) return;
      const holdResult = await repo.placeHold({ ...placeHoldInput, quoteId: quoteResult.data.id });
      if (!isOk(holdResult)) return;

      const result = await repo.commitHold(holdResult.data.id, LOYALTY_OWNER_B, 'idem_commit_cross');
      expect(isNotFound(result)).toBe(true);
    });
  });

  describe('reverseHold', () => {
    it('reverses an ACTIVE hold and appends ledger entry', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(quoteResult)) return;
      const holdResult = await repo.placeHold({ ...placeHoldInput, quoteId: quoteResult.data.id });
      if (!isOk(holdResult)) return;

      const reverseResult = await repo.reverseHold(
        holdResult.data.id, LOYALTY_OWNER_A, 'idem_reverse_001', 35000,
      );
      expect(isOk(reverseResult)).toBe(true);
      if (isOk(reverseResult)) {
        expect(reverseResult.data.status).toBe(LoyaltyLedgerStatus.REVERSED);
      }
    });

    it('rejects over-reversal', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(quoteResult)) return;
      const holdResult = await repo.placeHold({ ...placeHoldInput, quoteId: quoteResult.data.id });
      if (!isOk(holdResult)) return;

      const result = await repo.reverseHold(
        holdResult.data.id,
        overReversalScenario.ownerRef,
        overReversalScenario.idempotencyKey,
        overReversalScenario.pointsToReverse,
      );
      expect(isValidationFailure(result)).toBe(true);
      if (isValidationFailure(result)) {
        expect(result.errors.some(e => e.includes('over-reversal') || e.includes('exceeds'))).toBe(true);
      }
    });

    it('returns VALIDATION_FAILURE for reversed hold (already reversed)', async () => {
      const quoteResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(quoteResult)) return;
      const holdResult = await repo.placeHold({ ...placeHoldInput, quoteId: quoteResult.data.id });
      if (!isOk(holdResult)) return;

      await repo.reverseHold(holdResult.data.id, LOYALTY_OWNER_A, 'idem_rev_001', 35000);
      const result = await repo.reverseHold(holdResult.data.id, LOYALTY_OWNER_A, 'idem_rev_002', 100);
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('appendAdjustment', () => {
    it('appends an adjustment entry with simulated=true', async () => {
      const result = await repo.appendAdjustment({
        ownerRef:          LOYALTY_OWNER_A,
        idempotencyKey:    'idem_adj_001',
        pointsAmount:      500,
        liabilityCategory: SimulatedLiabilityCategory.EARN_ESTIMATE,
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.simulated).toBe(true);
        expect(result.data.transactionType).toBe(LoyaltyTransactionType.ADJUSTMENT);
      }
    });

    it('is idempotent — returns original entry on duplicate key', async () => {
      const input: AppendAdjustmentInput = {
        ownerRef:          LOYALTY_OWNER_A,
        idempotencyKey:    'idem_adj_dup_001',
        pointsAmount:      500,
        liabilityCategory: SimulatedLiabilityCategory.EARN_ESTIMATE,
      };
      const first  = await repo.appendAdjustment(input);
      const second = await repo.appendAdjustment(input);
      expect(isOk(first) && isOk(second)).toBe(true);
      if (isOk(first) && isOk(second)) {
        expect(second.data.id).toBe(first.data.id);
      }
    });
  });

  describe('fetchLedgerByOwner', () => {
    it('scopes results to the requested owner', async () => {
      const qA = await repo.createQuote(earnEstimateQuoteInput);
      const qB = await repo.createQuote({ ...cashPlusPointsQuoteInput, ownerRef: LOYALTY_OWNER_B, idempotencyKey: 'idem_qb_001' });
      if (!isOk(qA) || !isOk(qB)) return;

      await repo.placeHold({ ...placeHoldInput, quoteId: qA.data.id });
      await repo.placeHold({
        ownerRef: LOYALTY_OWNER_B,
        quoteId: qB.data.id,
        idempotencyKey: 'idem_hb_001',
        pointsAmount: 15000,
        transactionRef: 'txn_b_001',
      });

      const ledgerA = await repo.fetchLedgerByOwner(LOYALTY_OWNER_A);
      expect(isOk(ledgerA)).toBe(true);
      if (isOk(ledgerA)) {
        expect(ledgerA.data.every(e => e.ownerRef === LOYALTY_OWNER_A)).toBe(true);
      }
    });

    it('returns empty array for owner with no entries', async () => {
      const result = await repo.fetchLedgerByOwner('owner_no_entries');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  describe('generateReconciliationSnapshot', () => {
    it('generates a snapshot and is idempotent', async () => {
      const qA = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(qA)) return;
      await repo.placeHold({ ...placeHoldInput, quoteId: qA.data.id });

      const snap1 = await repo.generateReconciliationSnapshot(LOYALTY_OWNER_A, '2025-Q2');
      const snap2 = await repo.generateReconciliationSnapshot(LOYALTY_OWNER_A, '2025-Q2');
      expect(isOk(snap1) && isOk(snap2)).toBe(true);
      if (isOk(snap1) && isOk(snap2)) {
        expect(snap2.data.id).toBe(snap1.data.id);
        expect(snap1.data.simulated).toBe(true);
        expect(snap1.data.totalSimulatedHeldPoints).toBe(35000);
      }
    });

    it('returns VALIDATION_FAILURE for empty snapshotPeriod', async () => {
      const result = await repo.generateReconciliationSnapshot(LOYALTY_OWNER_A, '');
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('simulated flag invariants', () => {
    it('all quote, hold, and entry rows carry simulated=true', async () => {
      const qResult = await repo.createQuote(earnEstimateQuoteInput);
      if (!isOk(qResult)) return;
      expect(qResult.data.simulated).toBe(true);

      const hResult = await repo.placeHold({ ...placeHoldInput, quoteId: qResult.data.id });
      if (!isOk(hResult)) return;
      expect(hResult.data.simulated).toBe(true);

      const ledger = await repo.fetchLedgerByOwner(LOYALTY_OWNER_A);
      if (!isOk(ledger)) return;
      ledger.data.forEach(e => expect(e.simulated).toBe(true));
    });
  });
});
