/**
 * Unit tests for ConversationCheckpoint — domain types, validators, state
 * transitions, and in-memory fake repository implementation.
 *
 * No database required. Tests prove:
 *  - validateCheckpointPayload rejects sensitive fields at any nesting depth
 *  - OrchestratorPhase transitions are validated correctly
 *  - VERSION_CONFLICT is returned for stale expectedVersion
 *  - EXPIRED is returned for past-expiresAt checkpoints
 *  - NOT_FOUND is returned for cross-owner access (no resource enumeration)
 *  - DEGRADED agent step persists distinctly from FAILED
 *  - markIntentComplete sets INTENT_COMPLETE outcome and COMPLETE phase
 *  - expire() makes subsequent loadLatest return EXPIRED
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OrchestratorPhase,
  AgentStepStatus,
  CheckpointOutcome,
  DataClassificationTier,
  InventoryDomain,
  validateCheckpointPayload,
  isValidOrchestratorTransition,
  isTerminalCheckpointOutcome,
  isDegradedAgentStep,
  isTerminalAgentStepStatus,
} from '@voya/domain-model';
import {
  ok,
  notFound,
  expired,
  validationFailure,
  versionConflict,
  isOk,
  isNotFound,
  isExpired,
  isValidationFailure,
  isVersionConflict,
} from '../src/result.js';
import type { RepositoryResult } from '../src/result.js';
import type {
  ConversationCheckpointRow,
  AgentStepRow,
  CreateCheckpointInput,
  AppendStepResultInput,
  UpdateCheckpointInput,
  ConversationCheckpointRepository,
} from '../src/interfaces/conversation-checkpoint-repository.js';
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
  nestedSensitivePayloadFixture,
  cleanConstraintsPayload,
} from '@voya/test-fixtures';

// ---------------------------------------------------------------------------
// In-memory fake ConversationCheckpointRepository
// ---------------------------------------------------------------------------

let idSeq = 1;
function nextId(): string { return `chk_fake_${idSeq++}`; }

class FakeConversationCheckpointRepository implements ConversationCheckpointRepository {
  private readonly checkpoints = new Map<string, ConversationCheckpointRow & { _ownerRef: string }>();
  private readonly steps: AgentStepRow[] = [];

  async create(input: CreateCheckpointInput): Promise<RepositoryResult<ConversationCheckpointRow>> {
    if (!input.sessionRef) return validationFailure(['sessionRef must not be empty']);
    if (!input.ownerRef)   return validationFailure(['ownerRef must not be empty']);

    if (input.tripConstraintsJson) {
      const dm = validateCheckpointPayload(input.tripConstraintsJson);
      if (!dm.valid) return validationFailure([...dm.violations]);
    }
    if (input.pendingClarificationJson) {
      const dm = validateCheckpointPayload(input.pendingClarificationJson);
      if (!dm.valid) return validationFailure([...dm.violations]);
    }

    const row: ConversationCheckpointRow = {
      id:                          nextId(),
      sessionRef:                  input.sessionRef,
      ownerRef:                    input.ownerRef,
      checkpointVersion:           1,
      orchestratorPhase:           input.orchestratorPhase ?? OrchestratorPhase.INTENT_CAPTURE,
      outcome:                     CheckpointOutcome.ACTIVE,
      tripConstraintsJson:         input.tripConstraintsJson ?? null,
      pendingClarificationJson:    input.pendingClarificationJson ?? null,
      agentStatusSummaryJson:      null,
      safeToolSummariesJson:       null,
      naturalLanguageIntentSummary: input.naturalLanguageIntentSummary ?? null,
      expiresAt:                   input.expiresAt ?? null,
      dataClassification:          input.dataClassification ?? DataClassificationTier.INTERNAL,
      createdAt:                   new Date(),
      updatedAt:                   new Date(),
    };

    this.checkpoints.set(row.id, { ...row, _ownerRef: input.ownerRef });
    return ok(row);
  }

  async loadLatest(ownerRef: string, sessionRef: string): Promise<RepositoryResult<ConversationCheckpointRow>> {
    const rows = [...this.checkpoints.values()].filter(
      (r) => r.sessionRef === sessionRef && r._ownerRef === ownerRef,
    );
    if (rows.length === 0) return notFound();

    const latest = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (!latest) return notFound();

    if (latest.expiresAt && latest.expiresAt <= new Date()) {
      return expired(latest.expiresAt);
    }

    return ok(latest);
  }

  async appendStepResult(input: AppendStepResultInput): Promise<RepositoryResult<AgentStepRow>> {
    if (!input.checkpointId) return validationFailure(['checkpointId must not be empty']);
    if (input.stepIndex < 0) return validationFailure(['stepIndex must be non-negative']);

    if (input.safeOutputSummaryJson) {
      const dm = validateCheckpointPayload(input.safeOutputSummaryJson);
      if (!dm.valid) return validationFailure([...dm.violations]);
    }

    const checkpoint = this.checkpoints.get(input.checkpointId);
    if (!checkpoint || checkpoint._ownerRef !== input.ownerRef) return notFound();
    if (checkpoint.expiresAt && checkpoint.expiresAt <= new Date()) {
      return expired(checkpoint.expiresAt);
    }

    const step: AgentStepRow = {
      id:                    nextId(),
      checkpointId:          input.checkpointId,
      domain:                input.domain,
      status:                input.status,
      stepIndex:             input.stepIndex,
      safeOutputSummaryJson: input.safeOutputSummaryJson ?? null,
      degradedReasonCode:    input.degradedReasonCode ?? null,
      dataClassification:    DataClassificationTier.INTERNAL,
      createdAt:             new Date(),
      updatedAt:             new Date(),
    };
    this.steps.push(step);
    return ok(step);
  }

  async markDegraded(
    id: string,
    ownerRef: string,
    expectedVersion: number,
    degradedDomains: readonly InventoryDomain[],
  ): Promise<RepositoryResult<ConversationCheckpointRow>> {
    const row = this.checkpoints.get(id);
    if (!row || row._ownerRef !== ownerRef) return notFound();
    if (row.expiresAt && row.expiresAt <= new Date()) return expired(row.expiresAt);
    if (row.checkpointVersion !== expectedVersion) return versionConflict(row.checkpointVersion);

    const updated = { ...row, outcome: CheckpointOutcome.DEGRADED, checkpointVersion: row.checkpointVersion + 1, updatedAt: new Date() };
    this.checkpoints.set(id, updated);

    for (const step of this.steps) {
      if (
        step.checkpointId === id &&
        degradedDomains.includes(step.domain) &&
        (step.status === AgentStepStatus.PENDING || step.status === AgentStepStatus.RUNNING)
      ) {
        const idx = this.steps.indexOf(step);
        if (idx >= 0) {
          (this.steps[idx] as { status: AgentStepStatus }).status = AgentStepStatus.DEGRADED;
        }
      }
    }

    return ok(updated);
  }

  async markIntentComplete(
    id: string,
    ownerRef: string,
    expectedVersion: number,
  ): Promise<RepositoryResult<ConversationCheckpointRow>> {
    const row = this.checkpoints.get(id);
    if (!row || row._ownerRef !== ownerRef) return notFound();
    if (row.expiresAt && row.expiresAt <= new Date()) return expired(row.expiresAt);
    if (row.checkpointVersion !== expectedVersion) return versionConflict(row.checkpointVersion);

    const updated = {
      ...row,
      outcome:           CheckpointOutcome.INTENT_COMPLETE,
      orchestratorPhase: OrchestratorPhase.COMPLETE,
      checkpointVersion: row.checkpointVersion + 1,
      updatedAt:         new Date(),
    };
    this.checkpoints.set(id, updated);
    return ok(updated);
  }

  async expire(id: string, ownerRef: string): Promise<RepositoryResult<ConversationCheckpointRow>> {
    const row = this.checkpoints.get(id);
    if (!row || row._ownerRef !== ownerRef) return notFound();

    const now = new Date();
    const updated = {
      ...row,
      outcome:           CheckpointOutcome.EXPIRED,
      orchestratorPhase: OrchestratorPhase.EXPIRED,
      expiresAt:         now,
      checkpointVersion: row.checkpointVersion + 1,
      updatedAt:         now,
    };
    this.checkpoints.set(id, updated);
    return ok(updated);
  }

  async updateVersioned(input: UpdateCheckpointInput): Promise<RepositoryResult<ConversationCheckpointRow>> {
    if (!input.id)      return validationFailure(['id must not be empty']);
    if (!input.ownerRef) return validationFailure(['ownerRef must not be empty']);

    const row = this.checkpoints.get(input.id);
    if (!row || row._ownerRef !== input.ownerRef) return notFound();
    if (row.expiresAt && row.expiresAt <= new Date()) return expired(row.expiresAt);
    if (row.checkpointVersion !== input.expectedVersion) return versionConflict(row.checkpointVersion);

    const updated = {
      ...row,
      ...(input.orchestratorPhase !== undefined && { orchestratorPhase: input.orchestratorPhase }),
      ...(input.outcome !== undefined && { outcome: input.outcome }),
      ...(input.naturalLanguageIntentSummary !== undefined && { naturalLanguageIntentSummary: input.naturalLanguageIntentSummary }),
      checkpointVersion: row.checkpointVersion + 1,
      updatedAt:         new Date(),
    };
    this.checkpoints.set(input.id, updated);
    return ok(updated);
  }

  getStepsFor(checkpointId: string): AgentStepRow[] {
    return this.steps.filter((s) => s.checkpointId === checkpointId);
  }
}

// ===========================================================================
// Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// RepositoryResult EXPIRED variant
// ---------------------------------------------------------------------------

describe('RepositoryResult — EXPIRED variant', () => {
  it('expired() creates an EXPIRED result with expiredAt', () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    const r = expired<never>(at);
    expect(r.ok).toBe(false);
    expect(isExpired(r)).toBe(true);
    if (!r.ok && r.kind === 'EXPIRED') expect(r.expiredAt).toBe(at);
  });

  it('isExpired returns false for ok results', () => {
    const r = ok({ id: '1' });
    expect(isExpired(r)).toBe(false);
  });

  it('isExpired returns false for NOT_FOUND results', () => {
    expect(isExpired(notFound())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateCheckpointPayload — data minimization
// ---------------------------------------------------------------------------

describe('validateCheckpointPayload — data minimization', () => {
  it('accepts a clean payload with no sensitive fields', () => {
    const result = validateCheckpointPayload(cleanConstraintsPayload);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects a payload containing a top-level email field', () => {
    const result = validateCheckpointPayload(sensitivePayloadFixture);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes('email'))).toBe(true);
  });

  it('rejects a payload with nested bonvoyId', () => {
    const result = validateCheckpointPayload(nestedSensitivePayloadFixture);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('bonvoyId'))).toBe(true);
  });

  it('rejects a raw prompt field', () => {
    const result = validateCheckpointPayload({ destinationToken: 'dest_001', rawPrompt: 'system: ...' });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('rawPrompt'))).toBe(true);
  });

  it('rejects passport number', () => {
    const result = validateCheckpointPayload({ passportNumber: 'XX12345' });
    expect(result.valid).toBe(false);
  });

  it('rejects PAN at nested depth', () => {
    const result = validateCheckpointPayload({ payment: { pan: '4111111111111111' } });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('payment.pan'))).toBe(true);
  });

  it('accepts an empty payload object', () => {
    const result = validateCheckpointPayload({});
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OrchestratorPhase transitions
// ---------------------------------------------------------------------------

describe('isValidOrchestratorTransition', () => {
  it('INTENT_CAPTURE → CLARIFICATION is valid', () => {
    expect(isValidOrchestratorTransition(OrchestratorPhase.INTENT_CAPTURE, OrchestratorPhase.CLARIFICATION)).toBe(true);
  });

  it('INTENT_CAPTURE → SOURCING is valid (skip clarification)', () => {
    expect(isValidOrchestratorTransition(OrchestratorPhase.INTENT_CAPTURE, OrchestratorPhase.SOURCING)).toBe(true);
  });

  it('SOURCING → INTENT_CAPTURE is invalid', () => {
    expect(isValidOrchestratorTransition(OrchestratorPhase.SOURCING, OrchestratorPhase.INTENT_CAPTURE)).toBe(false);
  });

  it('COMPLETE → anything is invalid (terminal)', () => {
    expect(isValidOrchestratorTransition(OrchestratorPhase.COMPLETE, OrchestratorPhase.SOURCING)).toBe(false);
    expect(isValidOrchestratorTransition(OrchestratorPhase.COMPLETE, OrchestratorPhase.EXPIRED)).toBe(false);
  });

  it('EXPIRED → anything is invalid (terminal)', () => {
    expect(isValidOrchestratorTransition(OrchestratorPhase.EXPIRED, OrchestratorPhase.INTENT_CAPTURE)).toBe(false);
  });

  it('VERIFICATION → PRESENTING is valid', () => {
    expect(isValidOrchestratorTransition(OrchestratorPhase.VERIFICATION, OrchestratorPhase.PRESENTING)).toBe(true);
  });
});

describe('isTerminalCheckpointOutcome', () => {
  it('EXPIRED is terminal', () => {
    expect(isTerminalCheckpointOutcome(CheckpointOutcome.EXPIRED)).toBe(true);
  });

  it('INTENT_COMPLETE is terminal', () => {
    expect(isTerminalCheckpointOutcome(CheckpointOutcome.INTENT_COMPLETE)).toBe(true);
  });

  it('ACTIVE is not terminal', () => {
    expect(isTerminalCheckpointOutcome(CheckpointOutcome.ACTIVE)).toBe(false);
  });

  it('DEGRADED is not terminal', () => {
    expect(isTerminalCheckpointOutcome(CheckpointOutcome.DEGRADED)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AgentStepStatus helpers
// ---------------------------------------------------------------------------

describe('AgentStepStatus helpers', () => {
  it('isDegradedAgentStep returns true only for DEGRADED', () => {
    expect(isDegradedAgentStep(AgentStepStatus.DEGRADED)).toBe(true);
    expect(isDegradedAgentStep(AgentStepStatus.FAILED)).toBe(false);
    expect(isDegradedAgentStep(AgentStepStatus.COMPLETE)).toBe(false);
  });

  it('isTerminalAgentStepStatus returns true for COMPLETE, DEGRADED, FAILED, SKIPPED', () => {
    expect(isTerminalAgentStepStatus(AgentStepStatus.COMPLETE)).toBe(true);
    expect(isTerminalAgentStepStatus(AgentStepStatus.DEGRADED)).toBe(true);
    expect(isTerminalAgentStepStatus(AgentStepStatus.FAILED)).toBe(true);
    expect(isTerminalAgentStepStatus(AgentStepStatus.SKIPPED)).toBe(true);
    expect(isTerminalAgentStepStatus(AgentStepStatus.PENDING)).toBe(false);
    expect(isTerminalAgentStepStatus(AgentStepStatus.RUNNING)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FakeConversationCheckpointRepository — create and loadLatest
// ---------------------------------------------------------------------------

describe('ConversationCheckpointRepository — create and loadLatest', () => {
  let repo: FakeConversationCheckpointRepository;

  beforeEach(() => { repo = new FakeConversationCheckpointRepository(); });

  it('create returns ok with correct sessionRef and ownerRef', async () => {
    const result = await repo.create(pendingClarificationCheckpointInput as CreateCheckpointInput);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.sessionRef).toBe(SESSION_REF_TOKYO);
      expect(result.data.checkpointVersion).toBe(1);
    }
  });

  it('create returns VALIDATION_FAILURE for empty sessionRef', async () => {
    const result = await repo.create({ sessionRef: '', ownerRef: CHECKPOINT_OWNER_A });
    expect(isValidationFailure(result)).toBe(true);
  });

  it('create returns VALIDATION_FAILURE for sensitive tripConstraintsJson', async () => {
    const result = await repo.create({
      sessionRef:         SESSION_REF_PARIS,
      ownerRef:           CHECKPOINT_OWNER_A,
      tripConstraintsJson: sensitivePayloadFixture,
    });
    expect(isValidationFailure(result)).toBe(true);
  });

  it('loadLatest returns ok for matching owner and session', async () => {
    await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    const result = await repo.loadLatest(CHECKPOINT_OWNER_A, SESSION_REF_PARIS);
    expect(isOk(result)).toBe(true);
  });

  it('loadLatest returns NOT_FOUND for unknown session', async () => {
    const result = await repo.loadLatest(CHECKPOINT_OWNER_A, 'sess_unknown_999');
    expect(isNotFound(result)).toBe(true);
  });

  it('loadLatest returns NOT_FOUND for cross-owner access (resource enumeration guard)', async () => {
    await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    const result = await repo.loadLatest(CHECKPOINT_OWNER_B, SESSION_REF_PARIS);
    expect(isNotFound(result)).toBe(true);
  });

  it('loadLatest returns EXPIRED for a past-expiresAt checkpoint', async () => {
    await repo.create(expiredCheckpointInput as CreateCheckpointInput);
    const result = await repo.loadLatest(CHECKPOINT_OWNER_A, 'sess_test_expired_001');
    expect(isExpired(result)).toBe(true);
    if (!result.ok && result.kind === 'EXPIRED') {
      expect(result.expiredAt).toBeInstanceOf(Date);
    }
  });
});

// ---------------------------------------------------------------------------
// appendStepResult
// ---------------------------------------------------------------------------

describe('ConversationCheckpointRepository — appendStepResult', () => {
  let repo: FakeConversationCheckpointRepository;

  beforeEach(() => { repo = new FakeConversationCheckpointRepository(); });

  it('appends a COMPLETE step to a valid checkpoint', async () => {
    const chk = await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    expect(isOk(chk)).toBe(true);
    if (!isOk(chk)) return;

    const step = await repo.appendStepResult({
      checkpointId: chk.data.id,
      ownerRef:     CHECKPOINT_OWNER_A,
      domain:       InventoryDomain.ACCOMMODATION,
      status:       AgentStepStatus.COMPLETE,
      stepIndex:    0,
      safeOutputSummaryJson: { summarizedOutput: 'Found 5 HVMI properties.', domain: 'ACCOMMODATION', toolName: 'searchAccommodation', executedAt: '2026-07-30T10:00:00.000Z' },
    });
    expect(isOk(step)).toBe(true);
    if (isOk(step)) expect(step.data.status).toBe(AgentStepStatus.COMPLETE);
  });

  it('appends a DEGRADED step (distinct from FAILED)', async () => {
    const chk = await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const step = await repo.appendStepResult({
      checkpointId:      chk.data.id,
      ownerRef:          CHECKPOINT_OWNER_A,
      domain:            InventoryDomain.DINING,
      status:            AgentStepStatus.DEGRADED,
      stepIndex:         2,
      degradedReasonCode: degradedDiningStep.degradedReasonCode,
      safeOutputSummaryJson: degradedDiningStep.safeOutputSummaryJson,
    });
    expect(isOk(step)).toBe(true);
    if (isOk(step)) {
      expect(step.data.status).toBe(AgentStepStatus.DEGRADED);
      expect(step.data.degradedReasonCode).toBe('SUPPLIER_TIMEOUT');
    }
  });

  it('returns VALIDATION_FAILURE when safeOutputSummaryJson contains sensitive data', async () => {
    const chk = await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const step = await repo.appendStepResult({
      checkpointId:          chk.data.id,
      ownerRef:              CHECKPOINT_OWNER_A,
      domain:                InventoryDomain.ACCOMMODATION,
      status:                AgentStepStatus.COMPLETE,
      stepIndex:             0,
      safeOutputSummaryJson: { summarizedOutput: 'ok', email: 'bad@example.invalid' },
    });
    expect(isValidationFailure(step)).toBe(true);
  });

  it('returns NOT_FOUND for cross-owner append attempt', async () => {
    const chk = await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const step = await repo.appendStepResult({
      checkpointId: chk.data.id,
      ownerRef:     CHECKPOINT_OWNER_B,  // wrong owner
      domain:       InventoryDomain.ACCOMMODATION,
      status:       AgentStepStatus.COMPLETE,
      stepIndex:    0,
    });
    expect(isNotFound(step)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateVersioned — optimistic concurrency
// ---------------------------------------------------------------------------

describe('ConversationCheckpointRepository — updateVersioned', () => {
  let repo: FakeConversationCheckpointRepository;

  beforeEach(() => { repo = new FakeConversationCheckpointRepository(); });

  it('updates successfully with correct expectedVersion', async () => {
    const chk = await repo.create(pendingClarificationCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const result = await repo.updateVersioned({
      id:               chk.data.id,
      ownerRef:         CHECKPOINT_OWNER_A,
      expectedVersion:  1,
      orchestratorPhase: OrchestratorPhase.SOURCING,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.checkpointVersion).toBe(2);
      expect(result.data.orchestratorPhase).toBe(OrchestratorPhase.SOURCING);
    }
  });

  it('returns VERSION_CONFLICT for stale expectedVersion', async () => {
    const chk = await repo.create(pendingClarificationCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const stale = makeStaleVersionUpdateInput(chk.data.id);
    const result = await repo.updateVersioned(stale as UpdateCheckpointInput);
    expect(isVersionConflict(result)).toBe(true);
    if (!result.ok && result.kind === 'VERSION_CONFLICT') {
      expect(result.currentVersion).toBe(1);
    }
  });

  it('second concurrent update sees VERSION_CONFLICT after the first succeeds', async () => {
    const chk = await repo.create(pendingClarificationCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    // First update succeeds, version becomes 2
    const first = await repo.updateVersioned({
      id: chk.data.id, ownerRef: CHECKPOINT_OWNER_A, expectedVersion: 1,
      orchestratorPhase: OrchestratorPhase.SOURCING,
    });
    expect(isOk(first)).toBe(true);

    // Second concurrent update uses stale version 1 → conflict
    const second = await repo.updateVersioned({
      id: chk.data.id, ownerRef: CHECKPOINT_OWNER_A, expectedVersion: 1,
      orchestratorPhase: OrchestratorPhase.VERIFICATION,
    });
    expect(isVersionConflict(second)).toBe(true);
  });

  it('returns NOT_FOUND for cross-owner update', async () => {
    const chk = await repo.create(pendingClarificationCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const result = await repo.updateVersioned({
      id: chk.data.id, ownerRef: CHECKPOINT_OWNER_B, expectedVersion: 1,
    });
    expect(isNotFound(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// markDegraded and markIntentComplete
// ---------------------------------------------------------------------------

describe('ConversationCheckpointRepository — markDegraded', () => {
  let repo: FakeConversationCheckpointRepository;

  beforeEach(() => { repo = new FakeConversationCheckpointRepository(); });

  it('sets outcome to DEGRADED and increments version', async () => {
    const chk = await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const result = await repo.markDegraded(chk.data.id, CHECKPOINT_OWNER_A, 1, [InventoryDomain.DINING]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.outcome).toBe(CheckpointOutcome.DEGRADED);
      expect(result.data.checkpointVersion).toBe(2);
    }
  });

  it('updates pending dining step to DEGRADED', async () => {
    const chk = await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    await repo.appendStepResult({
      checkpointId: chk.data.id, ownerRef: CHECKPOINT_OWNER_A,
      domain: InventoryDomain.DINING, status: AgentStepStatus.PENDING, stepIndex: 0,
    });

    await repo.markDegraded(chk.data.id, CHECKPOINT_OWNER_A, 1, [InventoryDomain.DINING]);

    const steps = repo.getStepsFor(chk.data.id);
    expect(steps.every((s) => s.domain !== InventoryDomain.DINING || s.status === AgentStepStatus.DEGRADED)).toBe(true);
  });

  it('returns VERSION_CONFLICT for stale version', async () => {
    const chk = await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const result = await repo.markDegraded(chk.data.id, CHECKPOINT_OWNER_A, 999, [InventoryDomain.DINING]);
    expect(isVersionConflict(result)).toBe(true);
  });
});

describe('ConversationCheckpointRepository — markIntentComplete', () => {
  let repo: FakeConversationCheckpointRepository;

  beforeEach(() => { repo = new FakeConversationCheckpointRepository(); });

  it('sets outcome to INTENT_COMPLETE and phase to COMPLETE', async () => {
    const chk = await repo.create(intentCompleteCheckpointInput as CreateCheckpointInput);
    if (!isOk(chk)) return;

    const result = await repo.markIntentComplete(chk.data.id, CHECKPOINT_OWNER_A, 1);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.outcome).toBe(CheckpointOutcome.INTENT_COMPLETE);
      expect(result.data.orchestratorPhase).toBe(OrchestratorPhase.COMPLETE);
    }
  });
});

// ---------------------------------------------------------------------------
// expire
// ---------------------------------------------------------------------------

describe('ConversationCheckpointRepository — expire', () => {
  let repo: FakeConversationCheckpointRepository;

  beforeEach(() => { repo = new FakeConversationCheckpointRepository(); });

  it('expire() makes subsequent loadLatest return EXPIRED', async () => {
    const chk = await repo.create({
      sessionRef: 'sess_expire_test_001',
      ownerRef:   CHECKPOINT_OWNER_A,
      expiresAt:  new Date('2099-01-01'),  // far future — won't auto-expire
    });
    if (!isOk(chk)) return;

    const expireResult = await repo.expire(chk.data.id, CHECKPOINT_OWNER_A);
    expect(isOk(expireResult)).toBe(true);
    if (isOk(expireResult)) expect(expireResult.data.outcome).toBe(CheckpointOutcome.EXPIRED);

    // loadLatest after expire should return EXPIRED
    const loadResult = await repo.loadLatest(CHECKPOINT_OWNER_A, 'sess_expire_test_001');
    expect(isExpired(loadResult)).toBe(true);
  });

  it('expire() returns NOT_FOUND for cross-owner attempt', async () => {
    const chk = await repo.create({
      sessionRef: 'sess_expire_cross_001',
      ownerRef:   CHECKPOINT_OWNER_A,
    });
    if (!isOk(chk)) return;

    const result = await repo.expire(chk.data.id, CHECKPOINT_OWNER_B);
    expect(isNotFound(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Partial constraints — pending clarification fields are preserved exactly
// ---------------------------------------------------------------------------

describe('Partial constraints — pending clarification fields preserved', () => {
  it('stores partial constraints without nulling pending fields', async () => {
    const repo = new FakeConversationCheckpointRepository();
    const chk = await repo.create(pendingClarificationCheckpointInput as CreateCheckpointInput);
    expect(isOk(chk)).toBe(true);
    if (!isOk(chk)) return;

    const loaded = await repo.loadLatest(CHECKPOINT_OWNER_A, SESSION_REF_TOKYO);
    expect(isOk(loaded)).toBe(true);
    if (isOk(loaded)) {
      // pendingClarificationJson is preserved as-is
      expect(loaded.data.pendingClarificationJson).toBeTruthy();
      // tripConstraintsJson only has destination and interest tags (not check-in/out)
      const constraints = loaded.data.tripConstraintsJson as Record<string, unknown>;
      expect(constraints['destinationToken']).toBe('dest_test_tokyo_001');
      expect(constraints['checkInDate']).toBeUndefined();
    }
  });
});
