/**
 * ConversationCheckpointRepository — framework-independent interface
 *
 * Persists Path B assistant session state with versioned optimistic concurrency,
 * data-minimization controls, and typed expired/not-found results.
 *
 * No Prisma, Express, or LLM provider imports belong in this file.
 */

import type {
  OrchestratorPhase,
  AgentStepStatus,
  CheckpointOutcome,
} from '@voya/domain-model';
import type { InventoryDomain, DataClassificationTier } from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// Row types returned by the repository
// ---------------------------------------------------------------------------

export interface ConversationCheckpointRow {
  readonly id: string;
  readonly sessionRef: string;
  readonly ownerRef: string;
  readonly checkpointVersion: number;
  readonly orchestratorPhase: OrchestratorPhase;
  readonly outcome: CheckpointOutcome;
  readonly tripConstraintsJson: unknown;
  readonly pendingClarificationJson: unknown;
  readonly agentStatusSummaryJson: unknown;
  readonly safeToolSummariesJson: unknown;
  readonly naturalLanguageIntentSummary: string | null;
  readonly expiresAt: Date | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AgentStepRow {
  readonly id: string;
  readonly checkpointId: string;
  readonly domain: InventoryDomain;
  readonly status: AgentStepStatus;
  readonly stepIndex: number;
  readonly safeOutputSummaryJson: unknown;
  readonly degradedReasonCode: string | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCheckpointInput {
  readonly sessionRef: string;
  readonly ownerRef: string;
  readonly orchestratorPhase?: OrchestratorPhase;
  readonly tripConstraintsJson?: Record<string, unknown>;
  readonly pendingClarificationJson?: Record<string, unknown>;
  readonly naturalLanguageIntentSummary?: string;
  /** If omitted the checkpoint has no expiry; recommended to set for all Path B sessions. */
  readonly expiresAt?: Date;
  readonly dataClassification?: DataClassificationTier;
}

export interface AppendStepResultInput {
  readonly checkpointId: string;
  readonly ownerRef: string;
  readonly domain: InventoryDomain;
  readonly status: AgentStepStatus;
  readonly stepIndex: number;
  readonly safeOutputSummaryJson?: Record<string, unknown>;
  readonly degradedReasonCode?: string;
}

export interface UpdateCheckpointInput {
  readonly id: string;
  readonly ownerRef: string;
  /** Must match the current checkpointVersion — used for optimistic concurrency. */
  readonly expectedVersion: number;
  readonly orchestratorPhase?: OrchestratorPhase;
  readonly outcome?: CheckpointOutcome;
  readonly tripConstraintsJson?: Record<string, unknown>;
  readonly pendingClarificationJson?: Record<string, unknown>;
  readonly agentStatusSummaryJson?: Record<string, unknown>;
  readonly safeToolSummariesJson?: Record<string, unknown>;
  readonly naturalLanguageIntentSummary?: string;
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface ConversationCheckpointRepository {
  /**
   * Create a new checkpoint for the given session.
   * Validates payload fields for sensitive data before persisting.
   */
  create(
    input: CreateCheckpointInput,
  ): Promise<RepositoryResult<ConversationCheckpointRow>>;

  /**
   * Load the most recently created checkpoint for an owner+session combination.
   * Returns NOT_FOUND for missing sessions; EXPIRED for checkpoints past expiresAt.
   * Cross-owner access returns NOT_FOUND (no resource enumeration).
   */
  loadLatest(
    ownerRef: string,
    sessionRef: string,
  ): Promise<RepositoryResult<ConversationCheckpointRow>>;

  /**
   * Append a per-domain agent step result to an existing checkpoint.
   * Validates safeOutputSummaryJson for sensitive fields.
   * Returns NOT_FOUND or EXPIRED if the checkpoint cannot be written.
   */
  appendStepResult(
    input: AppendStepResultInput,
  ): Promise<RepositoryResult<AgentStepRow>>;

  /**
   * Mark the checkpoint as DEGRADED and update the specified domains' steps
   * to DEGRADED status. Uses expectedVersion for optimistic concurrency.
   */
  markDegraded(
    id: string,
    ownerRef: string,
    expectedVersion: number,
    degradedDomains: readonly InventoryDomain[],
  ): Promise<RepositoryResult<ConversationCheckpointRow>>;

  /**
   * Mark the checkpoint outcome as INTENT_COMPLETE and phase as COMPLETE.
   * Uses expectedVersion for optimistic concurrency.
   */
  markIntentComplete(
    id: string,
    ownerRef: string,
    expectedVersion: number,
  ): Promise<RepositoryResult<ConversationCheckpointRow>>;

  /**
   * Expire the checkpoint immediately, regardless of the stored expiresAt.
   * Used when a session is explicitly abandoned or superseded.
   */
  expire(
    id: string,
    ownerRef: string,
  ): Promise<RepositoryResult<ConversationCheckpointRow>>;

  /**
   * Versioned update — applies partial updates to the checkpoint and
   * increments checkpointVersion. Returns VERSION_CONFLICT if the stored
   * version does not match expectedVersion.
   */
  updateVersioned(
    input: UpdateCheckpointInput,
  ): Promise<RepositoryResult<ConversationCheckpointRow>>;
}
