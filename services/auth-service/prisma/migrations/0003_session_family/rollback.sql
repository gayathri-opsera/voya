ALTER TABLE "sessions"
  DROP COLUMN IF EXISTS "family_id",
  DROP COLUMN IF EXISTS "absolute_expires_at";

DROP INDEX IF EXISTS "sessions_family_id_idx";
DROP INDEX IF EXISTS "sessions_revoked_at_idx";
DROP INDEX IF EXISTS "sessions_expires_at_cleanup_idx";
DROP INDEX IF EXISTS "sessions_absolute_expires_at_idx";
