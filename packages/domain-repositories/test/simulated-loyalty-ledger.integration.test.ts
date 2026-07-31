/**
 * Integration tests for @voya/domain-repositories — PrismaSimulatedLoyaltyLedgerRepository
 *
 * These tests require a real database and are skipped when DATABASE_URL is
 * not set. They verify the full round-trip through Prisma: quote creation,
 * hold placement, commit, reversal, idempotency-key replay, ownership
 * boundaries, over-reversal rejection, and reconciliation snapshot math
 * against migration 000005_simulated_loyalty_ledger.
 *
 * Run locally with:
 *   DATABASE_URL=<url> npx vitest run test/simulated-loyalty-ledger.integration.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  PrismaSimulatedLoyaltyLedgerRepository,
  isOk,
  isNotFound,
  isValidationFailure,
} from '../src/index.js';
import { LoyaltyLedgerStatus, LoyaltyTransactionType } from '@voya/domain-model';
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

const HAS_DB = Boolean(process.env['DATABASE_URL']);

let prisma: PrismaClient;

// Per-run-unique idempotency key suffix so repeated CI runs against a shared
// database never collide on the unique idempotencyKey constraints.
const RUN = `it_${Date.now()}`;
function withRunSuffix<T extends { idempotencyKey: string }>(input: T): T {
  return { ...input, idempotencyKey: `${input.idempotencyKey}_${RUN}` };
}

describe.skipIf(!HAS_DB)('PrismaSimulatedLoyaltyLedgerRepository Integration Tests', () => {
  beforeEach(async () => {
    prisma = new PrismaClient();
  });

  // -------------------------------------------------------------------------
  // createQuote
  // -------------------------------------------------------------------------

  describe('createQuote', () => {
    it('creates a simulated earn quote', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const result = await repo.createQuote(withRunSuffix(simulatedEarnQuoteInput));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.data.simulated).toBe(true);
    });

    it('creates a cash-plus-points quote preserving points and cash separately', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const result = await repo.createQuote(withRunSuffix(cashPlusPointsQuoteInput));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.pointsAmount).toBeGreaterThan(0);
        expect(result.data.cashAmountMinorUnits).toBeGreaterThan(0);
        expect(result.data.currencyCode).toBe('USD');
      }
    });

    it('creates a certificate eligibility quote with a synthetic certificateRef', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const result = await repo.createQuote(withRunSuffix(certificateEligibilityQuoteInput));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.data.certificateRef).toMatch(/^cert_sim_/);
    });

    it('creates a Points Advance eligible quote', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const result = await repo.createQuote(withRunSuffix(pointsAdvanceEligibleQuoteInput));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.data.pointsAdvanceEligibility).toBe('ELIGIBLE');
    });

    it('replays the original quote on a duplicate idempotencyKey', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const input = withRunSuffix({ ...simulatedEarnQuoteInput, idempotencyKey: `idem_quote_dup_${RUN}` });
      const first = await repo.createQuote(input);
      const second = await repo.createQuote(input);
      expect(isOk(first)).toBe(true);
      expect(isOk(second)).toBe(true);
      if (isOk(first) && isOk(second)) expect(first.data.id).toBe(second.data.id);
    });
  });

  // -------------------------------------------------------------------------
  // placeHold / commitHold / reverseHold lifecycle
  // -------------------------------------------------------------------------

  describe('placeHold, commitHold, reverseHold lifecycle', () => {
    it('places a hold, derives HELD status, then commits and derives COMMITTED status', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const holdInput = withRunSuffix({ ...standardHoldInput, idempotencyKey: `idem_hold_lifecycle_${RUN}` });
      const hold = await repo.placeHold(holdInput);
      expect(isOk(hold)).toBe(true);
      if (!isOk(hold)) return;

      const heldStatus = await repo.fetchHoldStatus(hold.data.id, LOYALTY_OWNER_A);
      expect(isOk(heldStatus)).toBe(true);
      if (isOk(heldStatus)) expect(heldStatus.data).toBe(LoyaltyLedgerStatus.HELD);

      const commit = await repo.commitHold(
        withRunSuffix({ ...makeCommitInput(hold.data.id), idempotencyKey: `idem_commit_lifecycle_${RUN}` }),
      );
      expect(isOk(commit)).toBe(true);
      if (isOk(commit)) {
        expect(commit.data.transactionType).toBe(LoyaltyTransactionType.COMMIT);
        expect(commit.data.simulated).toBe(true);
      }

      const committedStatus = await repo.fetchHoldStatus(hold.data.id, LOYALTY_OWNER_A);
      if (isOk(committedStatus)) expect(committedStatus.data).toBe(LoyaltyLedgerStatus.COMMITTED);
    });

    it('reverses a committed hold within the committed amount', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const holdInput = withRunSuffix({ ...standardHoldInput, idempotencyKey: `idem_hold_reverse_${RUN}` });
      const hold = await repo.placeHold(holdInput);
      if (!isOk(hold)) return;
      await repo.commitHold(withRunSuffix({ ...makeCommitInput(hold.data.id), idempotencyKey: `idem_commit_reverse_${RUN}` }));

      const reversal = await repo.reverseHold(
        withRunSuffix({ ...makeValidReversalInput(hold.data.id), idempotencyKey: `idem_reversal_valid_${RUN}` }),
      );
      expect(isOk(reversal)).toBe(true);
      if (isOk(reversal)) {
        expect(reversal.data.transactionType).toBe(LoyaltyTransactionType.REVERSAL);
        expect(reversal.data.simulated).toBe(true);
      }
    });

    it('rejects a reversal that exceeds the held/committed amount', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const holdInput = withRunSuffix({ ...standardHoldInput, idempotencyKey: `idem_hold_overrev_${RUN}` });
      const hold = await repo.placeHold(holdInput);
      if (!isOk(hold)) return;

      const overReversal = await repo.reverseHold(
        withRunSuffix({ ...makeOverReversalInput(hold.data.id), idempotencyKey: `idem_reversal_over_${RUN}` }),
      );
      expect(isValidationFailure(overReversal)).toBe(true);
    });

    it('rejects commit for a cross-owner attempt without revealing the hold exists', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const holdInput = withRunSuffix({ ...standardHoldInput, idempotencyKey: `idem_hold_crossowner_${RUN}` });
      const hold = await repo.placeHold(holdInput);
      if (!isOk(hold)) return;

      const commit = await repo.commitHold(
        withRunSuffix({ ...makeCommitInput(hold.data.id, LOYALTY_OWNER_B), idempotencyKey: `idem_commit_crossowner_${RUN}` }),
      );
      expect(isNotFound(commit)).toBe(true);
    });

    it('rejects committing an already-committed hold', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const holdInput = withRunSuffix({ ...standardHoldInput, idempotencyKey: `idem_hold_doublecommit_${RUN}` });
      const hold = await repo.placeHold(holdInput);
      if (!isOk(hold)) return;

      await repo.commitHold(withRunSuffix({ ...makeCommitInput(hold.data.id), idempotencyKey: `idem_commit_first_${RUN}` }));
      const second = await repo.commitHold(
        withRunSuffix({ ...makeCommitInput(hold.data.id), idempotencyKey: `idem_commit_second_${RUN}` }),
      );
      expect(isValidationFailure(second)).toBe(true);
    });

    it('duplicate hold idempotencyKey replays the original hold rather than creating a second row', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const holdInput = withRunSuffix({ ...standardHoldInput, idempotencyKey: `idem_hold_duplicate_${RUN}` });
      const first = await repo.placeHold(holdInput);
      const second = await repo.placeHold(holdInput);
      expect(isOk(first)).toBe(true);
      expect(isOk(second)).toBe(true);
      if (isOk(first) && isOk(second)) expect(first.data.id).toBe(second.data.id);
    });
  });

  // -------------------------------------------------------------------------
  // fetchLedgerByOwner — ownership boundaries
  // -------------------------------------------------------------------------

  describe('fetchLedgerByOwner', () => {
    it('returns only entries belonging to the requested owner', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const holdInput = withRunSuffix({ ...standardHoldInput, idempotencyKey: `idem_hold_ownerscope_${RUN}` });
      const hold = await repo.placeHold(holdInput);
      if (!isOk(hold)) return;

      const ledgerA = await repo.fetchLedgerByOwner(LOYALTY_OWNER_A);
      expect(isOk(ledgerA)).toBe(true);
      if (isOk(ledgerA)) {
        expect(ledgerA.data.every((e) => e.ownerRef === LOYALTY_OWNER_A)).toBe(true);
        expect(ledgerA.data.some((e) => e.holdId === hold.data.id)).toBe(true);
      }

      const ledgerB = await repo.fetchLedgerByOwner(LOYALTY_OWNER_B);
      expect(isOk(ledgerB)).toBe(true);
      if (isOk(ledgerB)) {
        expect(ledgerB.data.some((e) => e.holdId === hold.data.id)).toBe(false);
      }
    });
  });

  // -------------------------------------------------------------------------
  // generateReconciliationSnapshot
  // -------------------------------------------------------------------------

  describe('generateReconciliationSnapshot', () => {
    it('computes deterministic totals for a bounded period and labels the snapshot simulated', async () => {
      const repo = new PrismaSimulatedLoyaltyLedgerRepository(prisma);
      const before = new Date();
      const holdInput = withRunSuffix({ ...standardHoldInput, idempotencyKey: `idem_hold_reconcile_${RUN}` });
      const hold = await repo.placeHold(holdInput);
      if (!isOk(hold)) return;
      await repo.commitHold(withRunSuffix({ ...makeCommitInput(hold.data.id), idempotencyKey: `idem_commit_reconcile_${RUN}` }));
      const after = new Date(Date.now() + 1000);

      const snapshot = await repo.generateReconciliationSnapshot(before, after);
      expect(isOk(snapshot)).toBe(true);
      if (isOk(snapshot)) {
        expect(snapshot.data.simulated).toBe(true);
        expect(snapshot.data.totalPointsHeld).toBeGreaterThanOrEqual(standardHoldInput.pointsAmount);
        expect(snapshot.data.totalPointsCommitted).toBeGreaterThanOrEqual(standardHoldInput.pointsAmount);
      }
    });
  });
});
