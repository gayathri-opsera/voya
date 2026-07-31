-- Migration 000006: Auth Identity
-- Adds identity and OIDC challenge tables for Bonvoy OIDC sign-in.
-- Alters traveller_profile to add lastActivityAt and status fields.
--
-- DESIGN INVARIANTS:
--   - providerSubjectHash stores SHA-256(sub) — raw Bonvoy subject is NEVER stored
--   - stateHash/nonceHash/pkceVerifierHash store SHA-256 digests for replay prevention
--   - consumedAt is set atomically on first use of a login challenge (one-time-use)
--   - identity_account_link.(provider, providerSubjectHash) UNIQUE prevents duplicate links
--   - oidc_login_challenge.stateHash UNIQUE prevents state collision
--   - No real Bonvoy account numbers, emails, names, or passport values are stored

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "TravellerProfileStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- ---------------------------------------------------------------------------
-- Alter traveller_profile (created in migration 000001)
-- ---------------------------------------------------------------------------

ALTER TABLE "traveller_profile"
  ADD COLUMN "status"         "TravellerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "lastActivityAt" TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- identity_account_link
-- ---------------------------------------------------------------------------

CREATE TABLE "identity_account_link" (
  "id"                  UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "travellerProfileId"  UUID                     NOT NULL,
  "provider"            TEXT                     NOT NULL DEFAULT 'bonvoy',
  "providerSubjectHash" TEXT                     NOT NULL,
  "verifiedTier"        TEXT                     NOT NULL,
  "linkedAt"            TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt"         TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataClassification"  "DataClassificationTier" NOT NULL DEFAULT 'CONFIDENTIAL',
  "createdAt"           TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_account_link_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_account_link_travellerProfileId_fkey"
    FOREIGN KEY ("travellerProfileId") REFERENCES "traveller_profile" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "identity_account_link_provider_subject_key"
  ON "identity_account_link" ("provider", "providerSubjectHash");
CREATE INDEX "identity_account_link_travellerProfileId"
  ON "identity_account_link" ("travellerProfileId");

-- ---------------------------------------------------------------------------
-- oidc_login_challenge
-- Short-lived one-time-use challenge. consumedAt is NULL until first use.
-- ---------------------------------------------------------------------------

CREATE TABLE "oidc_login_challenge" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "stateHash"        TEXT        NOT NULL,
  "nonceHash"        TEXT        NOT NULL,
  "pkceVerifierHash" TEXT        NOT NULL,
  "expiresAt"        TIMESTAMPTZ NOT NULL,
  "consumedAt"       TIMESTAMPTZ,
  "correlationId"    TEXT        NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oidc_login_challenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oidc_login_challenge_stateHash_key" ON "oidc_login_challenge" ("stateHash");
CREATE        INDEX "oidc_login_challenge_expiresAt"     ON "oidc_login_challenge" ("expiresAt");
