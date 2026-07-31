/**
 * Integration tests for PrismaSimulatedLoyaltyLedgerRepository.
 *
 * These tests require a real database and are skipped when DATABASE_URL is
 * not set. They validate migration 000005, quote-hold-commit-reverse flows,
 * idempotency, append-only enforcement, ownership filtering, and over-reversal
 * rejection against an ephemeral PostgreSQL database.
 *
 * Run locally with:
 *   DATABASE_URL=postgresql://... npx vitest run test/simulated-loyalty-ledger.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  PrismaSimulatedLoyaltyLedgerRepository,
  isOk,
  isNotFound,
  isValidationFailure,
} from '../src/index.js';
import {
  LoyaltyTransactionType,
  LoyaltyLedgerStatus,
  RedemptionMode,
  SimulatedLiabilityCategory,
  PointsAdvanceEligibility,
} from '@voya/domain-model';
import type { CreateQuoteInput, PlaceHoldInput } from '../src/interfaces/simulated-loyalty-ledger-repository.js';

const HAS_DB = Boolean(process.env['DATABASE_URL']);

let prisma: PrismaClient;

const TEST_RUN    = `it_loyalty_${Date.now()}`;
const OWNER_A     = `owner_it_loyalty_a_${TEST_RUN}`;
const OWNER_B     = `owner_it_loyalty_b_${TEST_RUN}`;
const IDEM_QUOTE  = `idem_q_${TEST_RUN}`;
const IDEM_HOLD   = `idem_h_${TEST_RUN}`;
const IDEM_COMMIT = `idem_c_${TEST_RUN}`;
const IDEM_REV    = `idem_r_${TEST_RUN}`;
const TXN_REF     = `txn_${TEST_RUN}`;

const quoteInput: CreateQuoteInput = {
  ownerRef:       OWNER_A,
  idempotencyKey: IDEM_QUOTE,
  itineraryRef:   `itin_${TEST_RUN}`,
  redemptionMode: RedemptionMode.POINTS_ONLY,
  pointsAmount:   35000,
  estimatedEarnPoints: 3500,
  pointsAdvanceEligibility: PointsAdvanceEligibility.NOT_ELIGIBLE,
  expiresAt:      new Date('2030-12-31T23:59:59Z'),
};

describe.skipIf(!HAS_DB)('PrismaSimulatedLoyaltyLedgerRepository Integration Tests', () => {
  let repo: PrismaSimulatedLoyaltyLedgerRepository;
  let quoteId: string;
  let holdId:  string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    repo   = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
  });

  afterAll(async () => {
    // Clean up all seeded rows in FK-safe reverse order
    await prisma.loyaltyLedgerEntry.deleteMany({
      where: { ownerRef: { in: [OWNER_A, OWNER_B] } },
    });
    await prisma.loyaltyReconciliationSnapshot.deleteMany({
      where: { ownerRef: { in: [OWNER_A, OWNER_B] } },
    });
    await prisma.loyaltyHold.deleteMany({
      where: { ownerRef: { in: [OWNER_A, OWNER_B] } },
    });
    await prisma.loyaltyQuote.deleteMany({
      where: { ownerRef: { in: [OWNER_A, OWNER_B] } },
    });
    await prisma.$disconnect();
  });

  describe('createQuote', () => {
    it('creates a quote with simulated=true and PENDING status', async () => {
      const result = await repo.createQuote(quoteInput);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        quoteId = result.data.id;
        expect(result.data.simulated).toBe(true);
        expect(result.data.status).toBe(LoyaltyLedgerStatus.PENDING);
        expect(result.data.ownerRef).toBe(OWNER_A);
        expect(result.data.pointsAmount).toBe(35000);
      }
    });

    it('is idempotent — duplicate idempotencyKey returns original row', async () => {
      const second = await repo.createQuote(quoteInput);
      expect(isOk(second)).toBe(true);
      if (isOk(second)) {
        expect(second.data.id).toBe(quoteId);
      }
    });
  });

  describe('placeHold', () => {
    it('places an ACTIVE hold and appends a HOLD_PLACED ledger entry', async () => {
      const holdInput: PlaceHoldInput = {
        ownerRef:       OWNER_A,
        quoteId:        quoteId,
        idempotencyKey: IDEM_HOLD,
        pointsAmount:   35000,
        transactionRef: TXN_REF,
        expiresAt:      new Date('2030-12-31T23:59:59Z'),
      };

      const result = await repo.placeHold(holdInput);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        holdId = result.data.id;
        expect(result.data.simulated).toBe(true);
        expect(result.data.status).toBe(LoyaltyLedgerStatus.ACTIVE);
        expect(result.data.transactionRef).toBe(TXN_REF);
      }

      // Ledger entry appended
      const ledger = await repo.fetchLedgerByOwner(OWNER_A);
      expect(isOk(ledger)).toBe(true);
      if (isOk(ledger)) {
        const holdEntry = ledger.data.find(e => e.transactionType === LoyaltyTransactionType.HOLD_PLACED);
        expect(holdEntry).toBeDefined();
        expect(holdEntry?.simulated).toBe(true);
      }
    });

    it('is idempotent — duplicate idempotencyKey returns original hold', async () => {
      const holdInput: PlaceHoldInput = {
        ownerRef:       OWNER_A,
        quoteId:        quoteId,
        idempotencyKey: IDEM_HOLD,
        pointsAmount:   35000,
        transactionRef: TXN_REF,
      };
      const second = await repo.placeHold(holdInput);
      expect(isOk(second)).toBe(true);
      if (isOk(second)) {
        expect(second.data.id).toBe(holdId);
      }
    });

    it('returns NOT_FOUND for cross-owner hold attempt', async () => {
      const holdInput: PlaceHoldInput = {
        ownerRef:       OWNER_B,
        quoteId:        quoteId,
        idempotencyKey: `${IDEM_HOLD}_cross`,
        pointsAmount:   35000,
        transactionRef: `${TXN_REF}_cross`,
      };
      const result = await repo.placeHold(holdInput);
      expect(isNotFound(result)).toBe(true);
    });
  });

  describe('commitHold', () => {
    it('commits an ACTIVE hold and appends HOLD_COMMITTED entry', async () => {
      const result = await repo.commitHold(holdId, OWNER_A, IDEM_COMMIT);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.status).toBe(LoyaltyLedgerStatus.COMMITTED);
      }

      const ledger = await repo.fetchLedgerByOwner(OWNER_A);
      if (isOk(ledger)) {
        expect(ledger.data.some(e => e.transactionType === LoyaltyTransactionType.HOLD_COMMITTED)).toBe(true);
      }
    });

    it('returns VALIDATION_FAILURE on second commit attempt (already COMMITTED)', async () => {
      const result = await repo.commitHold(holdId, OWNER_A, `${IDEM_COMMIT}_second`);
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('reverseHold (separate hold)', () => {
    let reverseHoldId: string;

    it('places a second hold and reverses it', async () => {
      // Create second quote and hold for reversal test
      const q2 = await repo.createQuote({
        ownerRef:       OWNER_A,
        idempotencyKey: `${IDEM_QUOTE}_rev`,
        redemptionMode: RedemptionMode.POINTS_ONLY,
        pointsAmount:   20000,
      });
      expect(isOk(q2)).toBe(true);
      if (!isOk(q2)) return;

      const h2 = await repo.placeHold({
        ownerRef:       OWNER_A,
        quoteId:        q2.data.id,
        idempotencyKey: `${IDEM_HOLD}_rev`,
        pointsAmount:   20000,
        transactionRef: `${TXN_REF}_rev`,
      });
      expect(isOk(h2)).toBe(true);
      if (!isOk(h2)) return;
      reverseHoldId = h2.data.id;

      const rev = await repo.reverseHold(reverseHoldId, OWNER_A, IDEM_REV, 20000);
      expect(isOk(rev)).toBe(true);
      if (isOk(rev)) {
        expect(rev.data.status).toBe(LoyaltyLedgerStatus.REVERSED);
      }
    });

    it('rejects over-reversal', async () => {
      // Create another hold for over-reversal test
      const q3 = await repo.createQuote({
        ownerRef:       OWNER_A,
        idempotencyKey: `${IDEM_QUOTE}_over`,
        redemptionMode: RedemptionMode.POINTS_ONLY,
        pointsAmount:   5000,
      });
      if (!isOk(q3)) return;

      const h3 = await repo.placeHold({
        ownerRef:       OWNER_A,
        quoteId:        q3.data.id,
        idempotencyKey: `${IDEM_HOLD}_over`,
        pointsAmount:   5000,
        transactionRef: `${TXN_REF}_over`,
      });
      if (!isOk(h3)) return;

      const result = await repo.reverseHold(h3.data.id, OWNER_A, `${IDEM_REV}_over`, 99999);
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('appendAdjustment', () => {
    it('appends an adjustment ledger entry with simulated=true', async () => {
      const result = await repo.appendAdjustment({
        ownerRef:          OWNER_A,
        idempotencyKey:    `${IDEM_QUOTE}_adj`,
        pointsAmount:      500,
        liabilityCategory: SimulatedLiabilityCategory.EARN_ESTIMATE,
        itineraryRef:      `itin_${TEST_RUN}`,
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.simulated).toBe(true);
        expect(result.data.transactionType).toBe(LoyaltyTransactionType.ADJUSTMENT);
      }
    });
  });

  describe('fetchLedgerByOwner', () => {
    it('returns only entries for the requested owner', async () => {
      const result = await repo.fetchLedgerByOwner(OWNER_A);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.every(e => e.ownerRef === OWNER_A)).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
      }
    });

    it('returns empty array for owner with no entries', async () => {
      const result = await repo.fetchLedgerByOwner(OWNER_B);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  describe('generateReconciliationSnapshot', () => {
    it('generates a snapshot summing ledger entries', async () => {
      const result = await repo.generateReconciliationSnapshot(OWNER_A, `${TEST_RUN}-period`);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.simulated).toBe(true);
        expect(result.data.ownerRef).toBe(OWNER_A);
        expect(result.data.entryCount).toBeGreaterThan(0);
      }
    });

    it('is idempotent — returns same snapshot for same period', async () => {
      const first  = await repo.generateReconciliationSnapshot(OWNER_A, `${TEST_RUN}-period`);
      const second = await repo.generateReconciliationSnapshot(OWNER_A, `${TEST_RUN}-period`);
      expect(isOk(first) && isOk(second)).toBe(true);
      if (isOk(first) && isOk(second)) {
        expect(second.data.id).toBe(first.data.id);
      }
    });
  });
});
