-- Migration: 000002_audit_ledger
-- Adds the AuditLedger model, AuditActorType enum, and extends AuditEventType
-- with new governance event types required by WO-486.
--
-- APPEND-ONLY CONTRACT: The audit_ledger table has no UPDATE or DELETE
-- statements in this migration, and application code must never issue them.

-- ---------------------------------------------------------------------------
-- 1. Add AuditActorType enum
-- ---------------------------------------------------------------------------

CREATE TYPE "AuditActorType" AS ENUM (
  'TRAVELLER_AUTHENTICATED',
  'TRAVELLER_GUEST',
  'SERVICE_PRINCIPAL',
  'AGENT_PRINCIPAL',
  'CUSTOMER_CARE_OPERATOR',
  'LOYALTY_ADMINISTRATOR',
  'MERCHANDISER',
  'FRAUD_ANALYST',
  'SYSTEM_PROCESS'
);

-- ---------------------------------------------------------------------------
-- 2. Extend AuditEventType with new governance event values
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in PostgreSQL,
-- so each statement is intentionally standalone.
-- ---------------------------------------------------------------------------

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'MANIFEST_EXCLUSION';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PROMPT_SAFETY_REJECTION';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'RECEIPT_BLOCKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'LOYALTY_SIMULATED_QUOTE';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'LOYALTY_SIMULATED_HOLD';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'LOYALTY_SIMULATED_COMMIT';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'LOYALTY_SIMULATED_REVERSAL';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CHECKOUT_STATE_TRANSITION';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AUTHENTICATION_EVENT';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'RETENTION_DECISION';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ADMIN_APPROVAL_EVIDENCE';

-- ---------------------------------------------------------------------------
-- 3. Create audit_ledger table (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE "audit_ledger" (
    "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    "eventType"           "AuditEventType"      NOT NULL,
    "actorType"           "AuditActorType"       NOT NULL,
    "actorRef"            TEXT         NOT NULL,
    "resourceType"        TEXT         NOT NULL,
    "resourceRef"         TEXT         NOT NULL,
    "occurredAt"          TIMESTAMPTZ  NOT NULL,
    "correlationId"       TEXT         NOT NULL,
    "classificationTier"  "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
    "redactedPayloadJson" JSONB        NOT NULL,
    "canonicalHash"       TEXT         NOT NULL,
    "createdAt"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "audit_ledger_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 4. Indexes for efficient ledger queries
-- ---------------------------------------------------------------------------

CREATE INDEX "audit_ledger_eventType_idx"    ON "audit_ledger" ("eventType");
CREATE INDEX "audit_ledger_resourceRef_idx"  ON "audit_ledger" ("resourceRef");
CREATE INDEX "audit_ledger_actorRef_idx"     ON "audit_ledger" ("actorRef");
CREATE INDEX "audit_ledger_occurredAt_idx"   ON "audit_ledger" ("occurredAt");
CREATE INDEX "audit_ledger_correlationId_idx" ON "audit_ledger" ("correlationId");
