-- Migration 000005: Simulated Loyalty Ledger
-- Adds the append-only simulated loyalty ledger tables for quote, hold,
-- ledger entry, reconciliation snapshot, and certificate reference.
--
-- DESIGN INVARIANTS:
--   - simulated column is always TRUE; no real Bonvoy balance is debited
--   - loyalty_ledger_entry has no updatedAt — rows are append-only, immutable
--   - idempotencyKey is UNIQUE on quote, hold, and ledger_entry to support
--     safe checkout saga retries
--   - All monetary values are integer minor units (cents); no floating-point
--   - ownerRef is a tokenized reference; no real Bonvoy account numbers stored
--   - certificateRef is a synthetic placeholder; no real Bonvoy cert numbers
--
-- Constraints:
--   - loyalty_quote.idempotencyKey UNIQUE
--   - loyalty_hold.idempotencyKey UNIQUE
--   - loyalty_hold.transactionRef UNIQUE
--   - loyalty_ledger_entry.idempotencyKey UNIQUE
--   - loyalty_reconciliation_snapshot.(ownerRef, snapshotPeriod) UNIQUE
--   - certificate_reference.certificateRef UNIQUE

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

CREATE TYPE "LoyaltyTransactionType" AS ENUM (
  'EARN_ESTIMATE',
  'AWARD_NIGHT',
  'CASH_PLUS_POINTS',
  'CERTIFICATE_REDEMPTION',
  'POINTS_ADVANCE',
  'ADJUSTMENT',
  'HOLD_PLACED',
  'HOLD_COMMITTED',
  'HOLD_REVERSED'
);

CREATE TYPE "LoyaltyLedgerStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'COMMITTED',
  'REVERSED',
  'EXPIRED',
  'REJECTED'
);

CREATE TYPE "RedemptionMode" AS ENUM (
  'CASH_ONLY',
  'POINTS_ONLY',
  'CASH_PLUS_POINTS',
  'CERTIFICATE',
  'POINTS_ADVANCE'
);

CREATE TYPE "PointsAdvanceEligibility" AS ENUM (
  'NOT_ELIGIBLE',
  'ELIGIBLE',
  'APPLIED'
);

CREATE TYPE "SimulatedLiabilityCategory" AS ENUM (
  'EARN_ESTIMATE',
  'REDEMPTION_HOLD',
  'REDEMPTION_COMMIT',
  'ADJUSTMENT',
  'CERTIFICATE_HOLD'
);

-- ---------------------------------------------------------------------------
-- loyalty_quote
-- ---------------------------------------------------------------------------

CREATE TABLE "loyalty_quote" (
  "id"                       UUID                       NOT NULL DEFAULT gen_random_uuid(),
  "ownerRef"                 TEXT                       NOT NULL,
  "idempotencyKey"           TEXT                       NOT NULL,
  "itineraryRef"             TEXT,
  "cartRef"                  TEXT,
  "lineItemRef"              TEXT,
  "redemptionMode"           "RedemptionMode"           NOT NULL,
  "pointsAmount"             INTEGER                    NOT NULL,
  "cashAmountMinorUnits"     INTEGER,
  "currencyCode"             TEXT,
  "estimatedEarnPoints"      INTEGER,
  "pointsAdvanceEligibility" "PointsAdvanceEligibility" NOT NULL DEFAULT 'NOT_ELIGIBLE',
  "certificateRef"           TEXT,
  "simulated"                BOOLEAN                    NOT NULL DEFAULT TRUE,
  "status"                   "LoyaltyLedgerStatus"      NOT NULL DEFAULT 'PENDING',
  "expiresAt"                TIMESTAMPTZ,
  "dataClassification"       "DataClassificationTier"   NOT NULL DEFAULT 'CONFIDENTIAL',
  "createdAt"                TIMESTAMPTZ                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMPTZ                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_quote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_quote_idempotencyKey_key" ON "loyalty_quote" ("idempotencyKey");
CREATE        INDEX "loyalty_quote_ownerRef"            ON "loyalty_quote" ("ownerRef");
CREATE        INDEX "loyalty_quote_itineraryRef"        ON "loyalty_quote" ("itineraryRef");
CREATE        INDEX "loyalty_quote_cartRef"             ON "loyalty_quote" ("cartRef");

-- ---------------------------------------------------------------------------
-- loyalty_hold
-- ---------------------------------------------------------------------------

CREATE TABLE "loyalty_hold" (
  "id"                   UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "ownerRef"             TEXT                   NOT NULL,
  "quoteId"              UUID                   NOT NULL,
  "idempotencyKey"       TEXT                   NOT NULL,
  "pointsAmount"         INTEGER                NOT NULL,
  "cashAmountMinorUnits" INTEGER,
  "currencyCode"         TEXT,
  "simulated"            BOOLEAN                NOT NULL DEFAULT TRUE,
  "status"               "LoyaltyLedgerStatus"  NOT NULL DEFAULT 'ACTIVE',
  "expiresAt"            TIMESTAMPTZ,
  "transactionRef"       TEXT                   NOT NULL,
  "dataClassification"   "DataClassificationTier" NOT NULL DEFAULT 'CONFIDENTIAL',
  "createdAt"            TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_hold_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_hold_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "loyalty_quote" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "loyalty_hold_idempotencyKey_key" ON "loyalty_hold" ("idempotencyKey");
CREATE UNIQUE INDEX "loyalty_hold_transactionRef_key"  ON "loyalty_hold" ("transactionRef");
CREATE        INDEX "loyalty_hold_ownerRef"             ON "loyalty_hold" ("ownerRef");
CREATE        INDEX "loyalty_hold_quoteId"              ON "loyalty_hold" ("quoteId");

-- ---------------------------------------------------------------------------
-- loyalty_ledger_entry
-- Append-only. No updatedAt column — rows must never be mutated after insert.
-- ---------------------------------------------------------------------------

CREATE TABLE "loyalty_ledger_entry" (
  "id"                   UUID                         NOT NULL DEFAULT gen_random_uuid(),
  "ownerRef"             TEXT                         NOT NULL,
  "quoteId"              UUID,
  "holdId"               UUID,
  "idempotencyKey"       TEXT                         NOT NULL,
  "transactionType"      "LoyaltyTransactionType"     NOT NULL,
  "liabilityCategory"    "SimulatedLiabilityCategory" NOT NULL,
  "pointsAmount"         INTEGER                      NOT NULL,
  "cashAmountMinorUnits" INTEGER,
  "currencyCode"         TEXT,
  "itineraryRef"         TEXT,
  "cartRef"              TEXT,
  "lineItemRef"          TEXT,
  "simulated"            BOOLEAN                      NOT NULL DEFAULT TRUE,
  "status"               "LoyaltyLedgerStatus"        NOT NULL,
  "dataClassification"   "DataClassificationTier"     NOT NULL DEFAULT 'CONFIDENTIAL',
  "createdAt"            TIMESTAMPTZ                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_ledger_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_ledger_entry_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "loyalty_quote" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loyalty_ledger_entry_holdId_fkey"
    FOREIGN KEY ("holdId") REFERENCES "loyalty_hold" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "loyalty_ledger_entry_idempotencyKey_key" ON "loyalty_ledger_entry" ("idempotencyKey");
CREATE        INDEX "loyalty_ledger_entry_ownerRef"            ON "loyalty_ledger_entry" ("ownerRef");
CREATE        INDEX "loyalty_ledger_entry_holdId"              ON "loyalty_ledger_entry" ("holdId");
CREATE        INDEX "loyalty_ledger_entry_quoteId"             ON "loyalty_ledger_entry" ("quoteId");
CREATE        INDEX "loyalty_ledger_entry_transactionType"     ON "loyalty_ledger_entry" ("transactionType");
CREATE        INDEX "loyalty_ledger_entry_status"              ON "loyalty_ledger_entry" ("status");

-- ---------------------------------------------------------------------------
-- loyalty_reconciliation_snapshot
-- ---------------------------------------------------------------------------

CREATE TABLE "loyalty_reconciliation_snapshot" (
  "id"                            UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "ownerRef"                      TEXT                   NOT NULL,
  "snapshotPeriod"                TEXT                   NOT NULL,
  "totalSimulatedEarnPoints"      INTEGER                NOT NULL DEFAULT 0,
  "totalSimulatedHeldPoints"      INTEGER                NOT NULL DEFAULT 0,
  "totalSimulatedCommittedPoints" INTEGER                NOT NULL DEFAULT 0,
  "totalSimulatedReversedPoints"  INTEGER                NOT NULL DEFAULT 0,
  "totalCashMinorUnits"           INTEGER                NOT NULL DEFAULT 0,
  "currencyCode"                  TEXT,
  "entryCount"                    INTEGER                NOT NULL DEFAULT 0,
  "simulated"                     BOOLEAN                NOT NULL DEFAULT TRUE,
  "generatedAt"                   TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataClassification"            "DataClassificationTier" NOT NULL DEFAULT 'CONFIDENTIAL',
  "createdAt"                     TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_reconciliation_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_recon_snapshot_ownerRef_period_key"
  ON "loyalty_reconciliation_snapshot" ("ownerRef", "snapshotPeriod");
CREATE INDEX "loyalty_recon_snapshot_ownerRef" ON "loyalty_reconciliation_snapshot" ("ownerRef");

-- ---------------------------------------------------------------------------
-- certificate_reference
-- Synthetic tokenized certificate. Never a real Bonvoy certificate number.
-- ---------------------------------------------------------------------------

CREATE TABLE "certificate_reference" (
  "id"                 UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "ownerRef"           TEXT                   NOT NULL,
  "certificateRef"     TEXT                   NOT NULL,
  "certificateType"    TEXT                   NOT NULL,
  "pointsValue"        INTEGER                NOT NULL,
  "expiresAt"          TIMESTAMPTZ,
  "simulated"          BOOLEAN                NOT NULL DEFAULT TRUE,
  "status"             "LoyaltyLedgerStatus"  NOT NULL DEFAULT 'ACTIVE',
  "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'CONFIDENTIAL',
  "createdAt"          TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certificate_reference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificate_reference_certificateRef_key" ON "certificate_reference" ("certificateRef");
CREATE        INDEX "certificate_reference_ownerRef"            ON "certificate_reference" ("ownerRef");
