-- Migration: 0003_session_family
-- Add family_id and absolute_expires_at for refresh-token rotation chains.

ALTER TABLE "sessions"
  ADD COLUMN "family_id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "absolute_expires_at" TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days';

-- Backfill: every existing session is its own family root.
UPDATE "sessions" SET "family_id" = "id";

-- Indexes for family revocation and cleanup queries.
CREATE INDEX "sessions_family_id_idx"            ON "sessions"("family_id");
CREATE INDEX "sessions_revoked_at_idx"           ON "sessions"("revoked_at");
CREATE INDEX "sessions_expires_at_cleanup_idx"   ON "sessions"("expires_at");
CREATE INDEX "sessions_absolute_expires_at_idx"  ON "sessions"("absolute_expires_at");
