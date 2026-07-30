/**
 * Prisma-backed ConversationCheckpointRepository implementation.
 *
 * Implements optimistic concurrency via checkpointVersion, data-minimization
 * via validateCheckpointPayload, and typed EXPIRED results for past-expiresAt
 * checkpoints. No raw prompt transcripts, PII, or LLM provider details are
 * stored or accepted.
 */

import type { PrismaClient } from '@prisma/client';
import {
  OrchestratorPhase,
  AgentStepStatus,
  CheckpointOutcome,
  DataClassificationTier,
  validateCheckpointPayload,
} from '@voya/domain-model';
import { ok, notFound, expired, validationFailure, versionConflict, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  ConversationCheckpointRow,
  AgentStepRow,
  CreateCheckpointInput,
  AppendStepResultInput,
  UpdateCheckpointInput,
  ConversationCheckpointRepository,
} from '../interfaces/conversation-checkpoint-repository.js';
import type { InventoryDomain } from '@voya/domain-model';

// Prisma transaction client excludes top-level lifecycle methods
type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class PrismaConversationCheckpointRepository
  implements ConversationCheckpointRepository
{
  constructor(private readonly db: PrismaClient) {}

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  async create(
    input: CreateCheckpointInput,
  ): Promise<RepositoryResult<ConversationCheckpointRow>> {
    const errors = validateCreateCheckpoint(input);
    if (errors.length > 0) return validationFailure(errors);

    try {
      const row = await this.db.assistantConversationCheckpoint.create({
        data: {
          sessionRef:                  input.sessionRef,
          ownerRef:                    input.ownerRef,
          orchestratorPhase:           (input.orchestratorPhase ?? OrchestratorPhase.INTENT_CAPTURE) as never,
          outcome:                     CheckpointOutcome.ACTIVE as never,
          tripConstraintsJson:         input.tripConstraintsJson ?? null,
          pendingClarificationJson:    input.pendingClarificationJson ?? null,
          naturalLanguageIntentSummary: input.naturalLanguageIntentSummary ?? null,
          expiresAt:                   input.expiresAt ?? null,
          dataClassification:          (input.dataClassification ?? DataClassificationTier.INTERNAL) as never,
        },
      });
      return ok(row as unknown as ConversationCheckpointRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // loadLatest
  // -------------------------------------------------------------------------

  async loadLatest(
    ownerRef: string,
    sessionRef: string,
  ): Promise<RepositoryResult<ConversationCheckpointRow>> {
    if (!ownerRef) return validationFailure(['ownerRef must not be empty']);
    if (!sessionRef) return validationFailure(['sessionRef must not be empty']);

    try {
      const row = await this.db.assistantConversationCheckpoint.findFirst({
        where:   { ownerRef, sessionRef },
        orderBy: { createdAt: 'desc' },
      });

      if (!row) return notFound();

      if (row.expiresAt && row.expiresAt <= new Date()) {
        return expired(row.expiresAt);
      }

      return ok(row as unknown as ConversationCheckpointRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // appendStepResult
  // -------------------------------------------------------------------------

  async appendStepResult(
    input: AppendStepResultInput,
  ): Promise<RepositoryResult<AgentStepRow>> {
    if (!input.checkpointId) return validationFailure(['checkpointId must not be empty']);
    if (!input.ownerRef) return validationFailure(['ownerRef must not be empty']);
    if (input.stepIndex < 0) return validationFailure(['stepIndex must be non-negative']);

    if (input.safeOutputSummaryJson) {
      const dm = validateCheckpointPayload(input.safeOutputSummaryJson);
      if (!dm.valid) return validationFailure([...dm.violations]);
    }

    try {
      const checkpoint = await this.db.assistantConversationCheckpoint.findUnique({
        where: { id: input.checkpointId },
      });

      if (!checkpoint || checkpoint.ownerRef !== input.ownerRef) return notFound();

      if (checkpoint.expiresAt && checkpoint.expiresAt <= new Date()) {
        return expired(checkpoint.expiresAt);
      }

      const step = await this.db.assistantAgentStep.create({
        data: {
          checkpointId:          input.checkpointId,
          domain:                input.domain as never,
          status:                input.status as never,
          stepIndex:             input.stepIndex,
          safeOutputSummaryJson: input.safeOutputSummaryJson ?? null,
          degradedReasonCode:    input.degradedReasonCode ?? null,
          dataClassification:    DataClassificationTier.INTERNAL as never,
        },
      });

      return ok(step as unknown as AgentStepRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // markDegraded
  // -------------------------------------------------------------------------

  async markDegraded(
    id: string,
    ownerRef: string,
    expectedVersion: number,
    degradedDomains: readonly InventoryDomain[],
  ): Promise<RepositoryResult<ConversationCheckpointRow>> {
    try {
      const current = await this.db.assistantConversationCheckpoint.findUnique({
        where: { id },
      });

      if (!current || current.ownerRef !== ownerRef) return notFound();
      if (current.expiresAt && current.expiresAt <= new Date()) return expired(current.expiresAt);
      if (current.checkpointVersion !== expectedVersion) {
        return versionConflict(current.checkpointVersion);
      }

      const updated = await this.db.$transaction(async (tx: PrismaTransactionClient) => {
        const checkpoint = await tx.assistantConversationCheckpoint.update({
          where: { id },
          data: {
            outcome:          CheckpointOutcome.DEGRADED as never,
            checkpointVersion: { increment: 1 },
          },
        });

        if (degradedDomains.length > 0) {
          await tx.assistantAgentStep.updateMany({
            where: {
              checkpointId: id,
              domain:       { in: degradedDomains as never[] },
              status:       { in: [AgentStepStatus.PENDING as never, AgentStepStatus.RUNNING as never] },
            },
            data: { status: AgentStepStatus.DEGRADED as never },
          });
        }

        return checkpoint;
      });

      return ok(updated as unknown as ConversationCheckpointRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // markIntentComplete
  // -------------------------------------------------------------------------

  async markIntentComplete(
    id: string,
    ownerRef: string,
    expectedVersion: number,
  ): Promise<RepositoryResult<ConversationCheckpointRow>> {
    try {
      const current = await this.db.assistantConversationCheckpoint.findUnique({
        where: { id },
      });

      if (!current || current.ownerRef !== ownerRef) return notFound();
      if (current.expiresAt && current.expiresAt <= new Date()) return expired(current.expiresAt);
      if (current.checkpointVersion !== expectedVersion) {
        return versionConflict(current.checkpointVersion);
      }

      const updated = await this.db.assistantConversationCheckpoint.update({
        where: { id },
        data: {
          outcome:           CheckpointOutcome.INTENT_COMPLETE as never,
          orchestratorPhase: OrchestratorPhase.COMPLETE as never,
          checkpointVersion: { increment: 1 },
        },
      });

      return ok(updated as unknown as ConversationCheckpointRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // expire
  // -------------------------------------------------------------------------

  async expire(
    id: string,
    ownerRef: string,
  ): Promise<RepositoryResult<ConversationCheckpointRow>> {
    try {
      const current = await this.db.assistantConversationCheckpoint.findUnique({
        where: { id },
      });

      if (!current || current.ownerRef !== ownerRef) return notFound();

      const now = new Date();
      const updated = await this.db.assistantConversationCheckpoint.update({
        where: { id },
        data: {
          outcome:           CheckpointOutcome.EXPIRED as never,
          orchestratorPhase: OrchestratorPhase.EXPIRED as never,
          expiresAt:         now,
          checkpointVersion: { increment: 1 },
        },
      });

      return ok(updated as unknown as ConversationCheckpointRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // updateVersioned
  // -------------------------------------------------------------------------

  async updateVersioned(
    input: UpdateCheckpointInput,
  ): Promise<RepositoryResult<ConversationCheckpointRow>> {
    if (!input.id) return validationFailure(['id must not be empty']);
    if (!input.ownerRef) return validationFailure(['ownerRef must not be empty']);

    // Validate all JSON payload fields for sensitive data
    if (input.tripConstraintsJson) {
      const dm = validateCheckpointPayload(input.tripConstraintsJson);
      if (!dm.valid) return validationFailure([...dm.violations]);
    }
    if (input.pendingClarificationJson) {
      const dm = validateCheckpointPayload(input.pendingClarificationJson);
      if (!dm.valid) return validationFailure([...dm.violations]);
    }
    if (input.agentStatusSummaryJson) {
      const dm = validateCheckpointPayload(input.agentStatusSummaryJson);
      if (!dm.valid) return validationFailure([...dm.violations]);
    }
    if (input.safeToolSummariesJson) {
      const dm = validateCheckpointPayload(input.safeToolSummariesJson);
      if (!dm.valid) return validationFailure([...dm.violations]);
    }

    try {
      const current = await this.db.assistantConversationCheckpoint.findUnique({
        where: { id: input.id },
      });

      if (!current || current.ownerRef !== input.ownerRef) return notFound();
      if (current.expiresAt && current.expiresAt <= new Date()) return expired(current.expiresAt);
      if (current.checkpointVersion !== input.expectedVersion) {
        return versionConflict(current.checkpointVersion);
      }

      const updateData: Record<string, unknown> = {
        checkpointVersion: { increment: 1 },
      };
      if (input.orchestratorPhase !== undefined)
        updateData['orchestratorPhase'] = input.orchestratorPhase;
      if (input.outcome !== undefined)
        updateData['outcome'] = input.outcome;
      if (input.tripConstraintsJson !== undefined)
        updateData['tripConstraintsJson'] = input.tripConstraintsJson;
      if (input.pendingClarificationJson !== undefined)
        updateData['pendingClarificationJson'] = input.pendingClarificationJson;
      if (input.agentStatusSummaryJson !== undefined)
        updateData['agentStatusSummaryJson'] = input.agentStatusSummaryJson;
      if (input.safeToolSummariesJson !== undefined)
        updateData['safeToolSummariesJson'] = input.safeToolSummariesJson;
      if (input.naturalLanguageIntentSummary !== undefined)
        updateData['naturalLanguageIntentSummary'] = input.naturalLanguageIntentSummary;

      const updated = await this.db.assistantConversationCheckpoint.update({
        where: { id: input.id },
        data:  updateData,
      });

      return ok(updated as unknown as ConversationCheckpointRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateCreateCheckpoint(input: CreateCheckpointInput): string[] {
  const errors: string[] = [];
  if (!input.sessionRef || input.sessionRef.trim() === '') errors.push('sessionRef must not be empty');
  if (!input.ownerRef || input.ownerRef.trim() === '') errors.push('ownerRef must not be empty');

  if (input.tripConstraintsJson) {
    const dm = validateCheckpointPayload(input.tripConstraintsJson);
    if (!dm.valid) errors.push(...dm.violations);
  }
  if (input.pendingClarificationJson) {
    const dm = validateCheckpointPayload(input.pendingClarificationJson);
    if (!dm.valid) errors.push(...dm.violations);
  }
  return errors;
}

function safeMessage(err: unknown): string {
  if (err instanceof Error)
    return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
