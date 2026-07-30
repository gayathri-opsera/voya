-- Migration: 0001_idempotency_audit_provenance
-- Additive-only: no column drops or renames.
-- Backward compatible with the previous service version for one full release.

-- ─── 1. processed_events (idempotency authority for inbound events) ──────────

CREATE TABLE IF NOT EXISTS "processed_events" (
    "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
    "provider"       TEXT        NOT NULL,
    "event_id"       TEXT        NOT NULL,
    "event_type"     TEXT        NOT NULL,
    "payload_digest" TEXT,
    "received_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "processed_at"   TIMESTAMPTZ,
    CONSTRAINT "processed_events_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "processed_events_provider_event_id_key" UNIQUE ("provider", "event_id")
);

CREATE INDEX IF NOT EXISTS "processed_events_received_at_idx"
    ON "processed_events" ("received_at");

-- ─── 2. booking_audit_log hardening ──────────────────────────────────────────
-- Add structural columns; all nullable/defaulted so prior-version inserts succeed.

ALTER TABLE "booking_audit_log"
    ADD COLUMN IF NOT EXISTS "actor_id"       TEXT,
    ADD COLUMN IF NOT EXISTS "actor_role"     TEXT,
    ADD COLUMN IF NOT EXISTS "resource_type"  TEXT,
    ADD COLUMN IF NOT EXISTS "resource_id"    TEXT,
    ADD COLUMN IF NOT EXISTS "occurred_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "sequence"       BIGINT GENERATED ALWAYS AS IDENTITY;

CREATE INDEX IF NOT EXISTS "booking_audit_log_resource_occurred_at_idx"
    ON "booking_audit_log" ("resource_id", "occurred_at");

-- Append-only trigger: reject UPDATE and DELETE at database level.
CREATE OR REPLACE FUNCTION enforce_audit_log_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'booking_audit_log is append-only: % operation is not permitted',
        TG_OP
        USING ERRCODE = 'restrict_violation',
              DETAIL   = 'Audit records may not be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_audit_log_immutable ON "booking_audit_log";
CREATE TRIGGER trg_booking_audit_log_immutable
    BEFORE UPDATE OR DELETE ON "booking_audit_log"
    FOR EACH ROW EXECUTE FUNCTION enforce_audit_log_immutability();

-- Privilege revocation (application roles cannot UPDATE/DELETE audit rows).
-- REVOKE UPDATE, DELETE ON "booking_audit_log" FROM PUBLIC;
-- Grant read/insert per role (roles created separately during cluster provisioning):
-- GRANT INSERT, SELECT ON "booking_audit_log" TO voya_app;

-- ─── 3. Booking: provenance + bookable columns ────────────────────────────────

ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "provenance" TEXT,
    ADD COLUMN IF NOT EXISTS "bookable"   BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 4. Backfill existing bookings with ILLUSTRATIVE provenance ───────────────
-- (non-bookable default is safe: prod bookings will have real provenance)
UPDATE "bookings"
SET "provenance" = 'ILLUSTRATIVE'
WHERE "provenance" IS NULL;
