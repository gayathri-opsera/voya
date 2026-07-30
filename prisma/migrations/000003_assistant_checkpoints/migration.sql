-- Migration 000003: Assistant Conversation Checkpoints
-- Adds assistant_conversation_checkpoint and assistant_agent_step tables for
-- Path B session recovery, optimistic-concurrency versioning, and per-domain
-- agent progress tracking.
--
-- Raw prompt transcripts, traveller PII, and payment data are structurally
-- absent from these tables by design — checkpoint payload validation must also
-- enforce this at the application layer before any insert or update.

-- ---------------------------------------------------------------------------
-- New enums
-- ---------------------------------------------------------------------------

CREATE TYPE "OrchestratorPhase" AS ENUM (
  'INTENT_CAPTURE',
  'CLARIFICATION',
  'SOURCING',
  'VERIFICATION',
  'PRESENTING',
  'COMPLETE',
  'EXPIRED'
);

CREATE TYPE "AgentStepStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETE',
  'DEGRADED',
  'FAILED',
  'SKIPPED'
);

CREATE TYPE "CheckpointOutcome" AS ENUM (
  'ACTIVE',
  'INTENT_COMPLETE',
  'DEGRADED',
  'EXPIRED'
);

-- ---------------------------------------------------------------------------
-- assistant_conversation_checkpoint
-- ---------------------------------------------------------------------------

CREATE TABLE "assistant_conversation_checkpoint" (
  "id"                           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "sessionRef"                   TEXT         NOT NULL,
  "ownerRef"                     TEXT         NOT NULL,
  "checkpointVersion"            INTEGER      NOT NULL DEFAULT 1,
  "orchestratorPhase"            "OrchestratorPhase" NOT NULL DEFAULT 'INTENT_CAPTURE',
  "outcome"                      "CheckpointOutcome" NOT NULL DEFAULT 'ACTIVE',
  "tripConstraintsJson"          JSONB,
  "pendingClarificationJson"     JSONB,
  "agentStatusSummaryJson"       JSONB,
  "safeToolSummariesJson"        JSONB,
  "naturalLanguageIntentSummary" TEXT,
  "expiresAt"                    TIMESTAMPTZ,
  "dataClassification"           "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
  "createdAt"                    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assistant_conversation_checkpoint_pkey" PRIMARY KEY ("id")
);

-- Composite index for session lookup — the primary access pattern
CREATE INDEX "acc_owner_session_idx"
  ON "assistant_conversation_checkpoint" ("ownerRef", "sessionRef");

-- Index for retention scan (purge jobs look up rows past expiresAt)
CREATE INDEX "acc_expires_at_idx"
  ON "assistant_conversation_checkpoint" ("expiresAt")
  WHERE "expiresAt" IS NOT NULL;

-- Index for optimistic concurrency conflict detection
CREATE INDEX "acc_checkpoint_version_idx"
  ON "assistant_conversation_checkpoint" ("checkpointVersion");

-- ---------------------------------------------------------------------------
-- assistant_agent_step
-- ---------------------------------------------------------------------------

CREATE TABLE "assistant_agent_step" (
  "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
  "checkpointId"          UUID         NOT NULL,
  "domain"                "InventoryDomain" NOT NULL,
  "status"                "AgentStepStatus" NOT NULL DEFAULT 'PENDING',
  "stepIndex"             INTEGER      NOT NULL,
  "safeOutputSummaryJson" JSONB,
  "degradedReasonCode"    TEXT,
  "dataClassification"    "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
  "createdAt"             TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assistant_agent_step_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistant_agent_step_checkpointId_fkey"
    FOREIGN KEY ("checkpointId")
    REFERENCES "assistant_conversation_checkpoint" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "aas_checkpoint_id_idx" ON "assistant_agent_step" ("checkpointId");
CREATE INDEX "aas_status_idx" ON "assistant_agent_step" ("status");
