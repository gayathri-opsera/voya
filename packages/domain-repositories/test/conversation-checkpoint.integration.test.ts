/**
 * Integration tests for PrismaConversationCheckpointRepository.
 *
 * These tests require a real database and are skipped when DATABASE_URL is
 * not set. They validate migration 000003, round-trip create/load, versioned
 * updates, stale-version conflict, expiry, degraded domain marking, and
 * append-only agent step persistence.
 *
 * Run locally with:
 *   DATABASE_URL=postgresql://... npx vitest run test/conversation-checkpoint.integration.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  PrismaConversationCheckpointRepository,
  isOk,
  isNotFound,
  isExpired,
  isValidationFailure,
  isVersionConflict,
} from '../src/index.js';
import {
  OrchestratorPhase,
  AgentStepStatus,
  CheckpointOutcome,
  InventoryDomain,
} from '@voya/domain-model';
import {
  CHECKPOINT_OWNER_A,
  CHECKPOINT_OWNER_B,
  SESSION_REF_PARIS,
  SESSION_REF_TOKYO,
  pendingClarificationCheckpointInput,
  intentCompleteCheckpointInput,
  expiredCheckpointInput,
  makeStaleVersionUpdateInput,
  degradedDiningStep,
  sensitivePayloadFixture,
  cleanConstraintsPayload,
} from '@voya/test-fixtures';
import type { CreateCheckpointInput, UpdateCheckpointInput, AppendStepResultInput } from '../src/interfaces/conversation-checkpoint-repository.js';

const HAS_DB = Boolean(process.env['DATABASE_URL']);

let prisma: PrismaClient;

describe.skipIf(!HAS_DB)('PrismaConversationCheckpointRepository Integration Tests', () => {
  beforeEach(async () => {
    prisma = new PrismaClient();
  });

  // -------------------------------------------------------------------------
  // Create and loadLatest round-trip
  // -------------------------------------------------------------------------

  describe('create and loadLatest', () => {
    it('creates a checkpoint and retrieves it by ownerRef+sessionRef', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create(pendingClarificationCheckpointInput as CreateCheckpointInput);
      expect(isOk(created)).toBe(true);
      if (!isOk(created)) return;

      const loaded = await repo.loadLatest(CHECKPOINT_OWNER_A, SESSION_REF_TOKYO);
      expect(isOk(loaded)).toBe(true);
      if (isOk(loaded)) {
        expect(loaded.data.sessionRef).toBe(SESSION_REF_TOKYO);
        expect(loaded.data.ownerRef).toBe(CHECKPOINT_OWNER_A);
        expect(loaded.data.checkpointVersion).toBe(1);
        expect(loaded.data.orchestratorPhase).toBe(OrchestratorPhase.CLARIFICATION);
      }
    });

    it('loadLatest returns NOT_FOUND for unknown session', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const result = await repo.loadLatest(CHECKPOINT_OWNER_A, 'sess_nonexistent_integration_zz');
      expect(isNotFound(result)).toBe(true);
    });

    it('loadLatest returns NOT_FOUND for cross-owner access', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);

      const cross = await repo.loadLatest(CHECKPOINT_OWNER_B, SESSION_REF_PARIS);
      expect(isNotFound(cross)).toBe(true);
    });

    it('loadLatest returns EXPIRED for a past-expiresAt checkpoint', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      await repo.create(expiredCheckpointInput as CreateCheckpointInput);

      const result = await repo.loadLatest(CHECKPOINT_OWNER_A, 'sess_test_expired_001');
      expect(isExpired(result)).toBe(true);
    });

    it('create returns VALIDATION_FAILURE for empty sessionRef', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const result = await repo.create({ sessionRef: '', ownerRef: CHECKPOINT_OWNER_A });
      expect(isValidationFailure(result)).toBe(true);
    });

    it('create returns VALIDATION_FAILURE for sensitive tripConstraintsJson', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const result = await repo.create({
        sessionRef:         `sess_int_sensitive_${Date.now()}`,
        ownerRef:           CHECKPOINT_OWNER_A,
        tripConstraintsJson: sensitivePayloadFixture,
      });
      expect(isValidationFailure(result)).toBe(true);
    });

    it('stores normalLanguageIntentSummary and clean constraints', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const input: CreateCheckpointInput = {
        sessionRef:                   `sess_int_clean_${Date.now()}`,
        ownerRef:                     CHECKPOINT_OWNER_A,
        orchestratorPhase:            OrchestratorPhase.SOURCING,
        tripConstraintsJson:          cleanConstraintsPayload,
        naturalLanguageIntentSummary: 'Premium Paris culinary trip, September 2026.',
        expiresAt:                    new Date('2099-01-01T00:00:00.000Z'),
      };

      const created = await repo.create(input);
      expect(isOk(created)).toBe(true);

      const loaded = await repo.loadLatest(CHECKPOINT_OWNER_A, input.sessionRef);
      expect(isOk(loaded)).toBe(true);
      if (isOk(loaded)) {
        expect(loaded.data.naturalLanguageIntentSummary).toBe('Premium Paris culinary trip, September 2026.');
        expect(loaded.data.tripConstraintsJson).toBeTruthy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // updateVersioned — optimistic concurrency
  // -------------------------------------------------------------------------

  describe('updateVersioned', () => {
    it('increments version on a successful update', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef:        `sess_int_update_${Date.now()}`,
        ownerRef:          CHECKPOINT_OWNER_A,
        orchestratorPhase: OrchestratorPhase.INTENT_CAPTURE,
        expiresAt:         new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const updated = await repo.updateVersioned({
        id:                created.data.id,
        ownerRef:          CHECKPOINT_OWNER_A,
        expectedVersion:   1,
        orchestratorPhase: OrchestratorPhase.CLARIFICATION,
      });
      expect(isOk(updated)).toBe(true);
      if (isOk(updated)) expect(updated.data.checkpointVersion).toBe(2);
    });

    it('returns VERSION_CONFLICT for stale expectedVersion', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef:        `sess_int_conflict_${Date.now()}`,
        ownerRef:          CHECKPOINT_OWNER_A,
        orchestratorPhase: OrchestratorPhase.INTENT_CAPTURE,
        expiresAt:         new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const stale = makeStaleVersionUpdateInput(created.data.id);
      const result = await repo.updateVersioned(stale as UpdateCheckpointInput);
      expect(isVersionConflict(result)).toBe(true);
    });

    it('second concurrent update conflicts after first succeeds', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef:        `sess_int_concurrent_${Date.now()}`,
        ownerRef:          CHECKPOINT_OWNER_A,
        orchestratorPhase: OrchestratorPhase.INTENT_CAPTURE,
        expiresAt:         new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const id = created.data.id;

      const first = await repo.updateVersioned({
        id, ownerRef: CHECKPOINT_OWNER_A, expectedVersion: 1,
        orchestratorPhase: OrchestratorPhase.CLARIFICATION,
      });
      expect(isOk(first)).toBe(true);

      const second = await repo.updateVersioned({
        id, ownerRef: CHECKPOINT_OWNER_A, expectedVersion: 1,
        orchestratorPhase: OrchestratorPhase.SOURCING,
      });
      expect(isVersionConflict(second)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // appendStepResult
  // -------------------------------------------------------------------------

  describe('appendStepResult', () => {
    it('creates a COMPLETE agent step linked to the checkpoint', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef: `sess_int_step_${Date.now()}`,
        ownerRef:   CHECKPOINT_OWNER_A,
        expiresAt:  new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const step = await repo.appendStepResult({
        checkpointId: created.data.id,
        ownerRef:     CHECKPOINT_OWNER_A,
        domain:       InventoryDomain.ACCOMMODATION,
        status:       AgentStepStatus.COMPLETE,
        stepIndex:    0,
        safeOutputSummaryJson: {
          summarizedOutput: 'Found 6 HVMI properties matching constraints.',
          domain:           'ACCOMMODATION',
          toolName:         'searchAccommodation',
          executedAt:       '2026-07-30T10:00:00.000Z',
        },
      } satisfies AppendStepResultInput);
      expect(isOk(step)).toBe(true);
      if (isOk(step)) {
        expect(step.data.status).toBe(AgentStepStatus.COMPLETE);
        expect(step.data.domain).toBe(InventoryDomain.ACCOMMODATION);
      }
    });

    it('creates a DEGRADED step (distinct from FAILED)', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef: `sess_int_degraded_${Date.now()}`,
        ownerRef:   CHECKPOINT_OWNER_A,
        expiresAt:  new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const step = await repo.appendStepResult({
        checkpointId:      created.data.id,
        ownerRef:          CHECKPOINT_OWNER_A,
        domain:            InventoryDomain.DINING,
        status:            AgentStepStatus.DEGRADED,
        stepIndex:         2,
        degradedReasonCode: degradedDiningStep.degradedReasonCode,
        safeOutputSummaryJson: degradedDiningStep.safeOutputSummaryJson,
      } satisfies AppendStepResultInput);
      expect(isOk(step)).toBe(true);
      if (isOk(step)) {
        expect(step.data.status).toBe(AgentStepStatus.DEGRADED);
        expect(step.data.degradedReasonCode).toBe('SUPPLIER_TIMEOUT');
      }
    });

    it('returns NOT_FOUND for cross-owner step append', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef: `sess_int_step_cross_${Date.now()}`,
        ownerRef:   CHECKPOINT_OWNER_A,
        expiresAt:  new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const step = await repo.appendStepResult({
        checkpointId: created.data.id,
        ownerRef:     CHECKPOINT_OWNER_B,
        domain:       InventoryDomain.ACCOMMODATION,
        status:       AgentStepStatus.COMPLETE,
        stepIndex:    0,
      } satisfies AppendStepResultInput);
      expect(isNotFound(step)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for sensitive safeOutputSummaryJson', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef: `sess_int_step_sensitive_${Date.now()}`,
        ownerRef:   CHECKPOINT_OWNER_A,
        expiresAt:  new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const step = await repo.appendStepResult({
        checkpointId:          created.data.id,
        ownerRef:              CHECKPOINT_OWNER_A,
        domain:                InventoryDomain.ACCOMMODATION,
        status:                AgentStepStatus.COMPLETE,
        stepIndex:             0,
        safeOutputSummaryJson: { summarizedOutput: 'ok', email: 'bad@example.invalid' },
      } satisfies AppendStepResultInput);
      expect(isValidationFailure(step)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // markDegraded
  // -------------------------------------------------------------------------

  describe('markDegraded', () => {
    it('sets outcome to DEGRADED and increments version', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef:        `sess_int_degrade_${Date.now()}`,
        ownerRef:          CHECKPOINT_OWNER_A,
        orchestratorPhase: OrchestratorPhase.SOURCING,
        expiresAt:         new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const result = await repo.markDegraded(
        created.data.id,
        CHECKPOINT_OWNER_A,
        1,
        [InventoryDomain.DINING],
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.outcome).toBe(CheckpointOutcome.DEGRADED);
        expect(result.data.checkpointVersion).toBe(2);
      }
    });

    it('returns VERSION_CONFLICT for wrong expectedVersion', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef: `sess_int_degrade_conflict_${Date.now()}`,
        ownerRef:   CHECKPOINT_OWNER_A,
        expiresAt:  new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const result = await repo.markDegraded(created.data.id, CHECKPOINT_OWNER_A, 999, []);
      expect(isVersionConflict(result)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // markIntentComplete
  // -------------------------------------------------------------------------

  describe('markIntentComplete', () => {
    it('sets outcome INTENT_COMPLETE and phase COMPLETE', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef:        `sess_int_complete_${Date.now()}`,
        ownerRef:          CHECKPOINT_OWNER_A,
        orchestratorPhase: OrchestratorPhase.SOURCING,
        expiresAt:         new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const result = await repo.markIntentComplete(created.data.id, CHECKPOINT_OWNER_A, 1);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.outcome).toBe(CheckpointOutcome.INTENT_COMPLETE);
        expect(result.data.orchestratorPhase).toBe(OrchestratorPhase.COMPLETE);
      }
    });
  });

  // -------------------------------------------------------------------------
  // expire
  // -------------------------------------------------------------------------

  describe('expire', () => {
    it('sets outcome EXPIRED and blocks subsequent loadLatest', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const sessionRef = `sess_int_expire_${Date.now()}`;
      const created = await repo.create({
        sessionRef,
        ownerRef:  CHECKPOINT_OWNER_A,
        expiresAt: new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const expireResult = await repo.expire(created.data.id, CHECKPOINT_OWNER_A);
      expect(isOk(expireResult)).toBe(true);
      if (isOk(expireResult)) expect(expireResult.data.outcome).toBe(CheckpointOutcome.EXPIRED);

      const reload = await repo.loadLatest(CHECKPOINT_OWNER_A, sessionRef);
      expect(isExpired(reload)).toBe(true);
    });

    it('returns NOT_FOUND for cross-owner expire attempt', async () => {
      const repo = new PrismaConversationCheckpointRepository(prisma);
      const created = await repo.create({
        sessionRef: `sess_int_expire_cross_${Date.now()}`,
        ownerRef:   CHECKPOINT_OWNER_A,
        expiresAt:  new Date('2099-01-01'),
      });
      if (!isOk(created)) return;

      const result = await repo.expire(created.data.id, CHECKPOINT_OWNER_B);
      expect(isNotFound(result)).toBe(true);
    });
  });
});
