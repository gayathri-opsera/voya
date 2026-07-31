-- Migration 000005: Simulated Loyalty Ledger
-- Adds loyalty_quote, loyalty_hold, loyalty_ledger_entry,
-- loyalty_reconciliation_snapshot, and certificate_reference tables.
--
-- Every row in these tables carries simulated = TRUE: no real Bonvoy balance
-- is ever read, reserved, debited, or credited by this schema. Real Bonvoy
-- account numbers are never stored; ownerRef is the same tokenized reference
-- pattern used by traveller_profile.ownerRef.
--
-- Constraints:
--   - loyalty_quote.idempotencyKey UNIQUE
--   - loyalty_hold.idempotencyKey UNIQUE
--   - loyalty_ledger_entry.idempotencyKey UNIQUE
--   - certificate_reference.certificateRef UNIQUE
--
-- loyalty_ledger_entry is append-only by application contract: no UPDATE or
-- DELETE operation is exposed through the repository layer. Current hold
-- status is derived from the most recent ledger entry for a given holdId,
-- not stored as a mutable column on loyalty_hold.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "LoyaltyTransactionType" AS ENUM ('QUOTE', 'HOLD', 'COMMIT', 'REVERSAL', 'ADJUSTMENT');

CREATE TYPE "LoyaltyLedgerStatus" AS ENUM ('QUOTED', 'HELD', 'COMMITTED', 'REVERSED', 'EXPIRED', 'ADJUSTED');

CREATE TYPE "RedemptionMode" AS ENUM ('STANDARD_AWARD_NIGHT', 'CASH_PLUS_POINTS', 'CERTIFICATE', 'POINTS_ADVANCE');

CREATE TYPE "PointsAdvanceEligibility" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'NOT_EVALUATED');

CREATE TYPE "SimulatedLiabilityCategory" AS ENUM (
  'ESTIMATED_EARN',
  'AWARD_NIGHT_REDEMPTION',
  'CASH_PLUS_POINTS_REDEMPTION',
  'CERTIFICATE_REDEMPTION',
  'POINTS_ADVANCE_REDEMPTION',
  'ADJUSTMENT'
);

-- ---------------------------------------------------------------------------
-- loyalty_quote
-- ---------------------------------------------------------------------------

CREATE TABLE "loyalty_quote" (
  "id"                       UUID                         NOT NULL DEFAULT gen_random_uuid(),
  "ownerRef"                 TEXT                         NOT NULL,
  "itineraryRef"              TEXT,
  "sourceLineRef"             TEXT,
  "redemptionMode"           "RedemptionMode"             NOT NULL,
  "pointsAmount"             INTEGER                      NOT NULL,
  "cashAmountMinorUnits"     INTEGER,
  "currencyCode"             TEXT,
  "certificateRef"           TEXT,
  "pointsAdvanceEligibility" "PointsAdvanceEligibility"   NOT NULL DEFAULT 'NOT_EVALUATED',
  "liabilityCategory"        "SimulatedLiabilityCategory" NOT NULL,
  "simulated"                BOOLEAN                      NOT NULL DEFAULT TRUE,
  "idempotencyKey"           TEXT                         NOT NULL,
  "dataClassification"       "DataClassificationTier"     NOT NULL DEFAULT 'INTERNAL',
  "createdAt"                TIMESTAMPTZ                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_quote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_quote_idempotencyKey_key" ON "loyalty_quote" ("idempotencyKey");
CREATE        INDEX "loyalty_quote_ownerRef_idx"       ON "loyalty_quote" ("ownerRef");
CREATE        INDEX "loyalty_quote_itineraryRef_idx"    ON "loyalty_quote" ("itineraryRef");

-- ---------------------------------------------------------------------------
-- loyalty_hold
-- ---------------------------------------------------------------------------

CREATE TABLE "loyalty_hold" (
  "id"                   UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "quoteId"              UUID,
  "ownerRef"             TEXT                     NOT NULL,
  "itineraryRef"          TEXT,
  "sourceLineRef"         TEXT,
  "redemptionMode"       "RedemptionMode"         NOT NULL,
  "pointsAmount"         INTEGER                  NOT NULL,
  "cashAmountMinorUnits" INTEGER,
  "currencyCode"         TEXT,
  "simulated"            BOOLEAN                  NOT NULL DEFAULT TRUE,
  "idempotencyKey"       TEXT                     NOT NULL,
  "expiresAt"            TIMESTAMPTZ,
  "dataClassification"   "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
  "createdAt"            TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_hold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_hold_idempotencyKey_key" ON "loyalty_hold" ("idempotencyKey");
CREATE        INDEX "loyalty_hold_ownerRef_idx"       ON "loyalty_hold" ("ownerRef");
CREATE        INDEX "loyalty_hold_itineraryRef_idx"    ON "loyalty_hold" ("itineraryRef");

ALTER TABLE "loyalty_hold"
  ADD CONSTRAINT "loyalty_hold_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "loyalty_quote"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- loyalty_ledger_entry (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE "loyalty_ledger_entry" (
  "id"                   UUID                         NOT NULL DEFAULT gen_random_uuid(),
  "holdId"               UUID,
  "ownerRef"             TEXT                         NOT NULL,
  "itineraryRef"          TEXT,
  "sourceLineRef"         TEXT,
  "transactionType"      "LoyaltyTransactionType"     NOT NULL,
  "status"               "LoyaltyLedgerStatus"        NOT NULL,
  "redemptionMode"       "RedemptionMode"             NOT NULL,
  "pointsAmount"         INTEGER                      NOT NULL,
  "cashAmountMinorUnits" INTEGER,
  "currencyCode"         TEXT,
  "liabilityCategory"    "SimulatedLiabilityCategory" NOT NULL,
  "simulated"            BOOLEAN                      NOT NULL DEFAULT TRUE,
  "idempotencyKey"       TEXT                         NOT NULL,
  "dataClassification"   "DataClassificationTier"     NOT NULL DEFAULT 'INTERNAL',
  "createdAt"            TIMESTAMPTZ                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_ledger_entry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_ledger_entry_idempotencyKey_key" ON "loyalty_ledger_entry" ("idempotencyKey");
CREATE        INDEX "loyalty_ledger_entry_ownerRef_idx"       ON "loyalty_ledger_entry" ("ownerRef");
CREATE        INDEX "loyalty_ledger_entry_holdId_idx"         ON "loyalty_ledger_entry" ("holdId");
CREATE        INDEX "loyalty_ledger_entry_transactionType_idx" ON "loyalty_ledger_entry" ("transactionType");
CREATE        INDEX "loyalty_ledger_entry_status_idx"          ON "loyalty_ledger_entry" ("status");

ALTER TABLE "loyalty_ledger_entry"
  ADD CONSTRAINT "loyalty_ledger_entry_holdId_fkey"
  FOREIGN KEY ("holdId") REFERENCES "loyalty_hold"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- loyalty_reconciliation_snapshot
-- ---------------------------------------------------------------------------

CREATE TABLE "loyalty_reconciliation_snapshot" (
  "id"                           UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "periodStart"                  TIMESTAMPTZ              NOT NULL,
  "periodEnd"                    TIMESTAMPTZ              NOT NULL,
  "totalPointsHeld"              INTEGER                  NOT NULL,
  "totalPointsCommitted"         INTEGER                  NOT NULL,
  "totalPointsReversed"          INTEGER                  NOT NULL,
  "totalCashMinorUnitsCommitted" INTEGER                  NOT NULL,
  "currencyCode"                 TEXT,
  "simulated"                    BOOLEAN                  NOT NULL DEFAULT TRUE,
  "dataClassification"           "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
  "generatedAt"                  TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_reconciliation_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loyalty_reconciliation_snapshot_period_idx"
  ON "loyalty_reconciliation_snapshot" ("periodStart", "periodEnd");

-- ---------------------------------------------------------------------------
-- certificate_reference
-- ---------------------------------------------------------------------------

CREATE TABLE "certificate_reference" (
  "id"                 UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "certificateRef"     TEXT                     NOT NULL,
  "ownerRef"           TEXT                     NOT NULL,
  "isRedeemed"         BOOLEAN                  NOT NULL DEFAULT FALSE,
  "redeemedAt"         TIMESTAMPTZ,
  "expiresAt"          TIMESTAMPTZ,
  "simulated"          BOOLEAN                  NOT NULL DEFAULT TRUE,
  "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
  "createdAt"          TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certificate_reference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificate_reference_certificateRef_key" ON "certificate_reference" ("certificateRef");
CREATE        INDEX "certificate_reference_ownerRef_idx"       ON "certificate_reference" ("ownerRef");
