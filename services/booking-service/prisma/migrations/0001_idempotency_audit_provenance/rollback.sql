-- Rollback: 0001_idempotency_audit_provenance
-- Run this ONLY for emergency rollback; it is destructive.

-- 4. Remove provenance/bookable
ALTER TABLE "bookings"
    DROP COLUMN IF EXISTS "provenance",
    DROP COLUMN IF EXISTS "bookable";

-- 3. Remove booking_audit_log additions
DROP TRIGGER IF EXISTS trg_booking_audit_log_immutable ON "booking_audit_log";
DROP FUNCTION IF EXISTS enforce_audit_log_immutability();

DROP INDEX IF EXISTS "booking_audit_log_resource_occurred_at_idx";

ALTER TABLE "booking_audit_log"
    DROP COLUMN IF EXISTS "sequence",
    DROP COLUMN IF EXISTS "occurred_at",
    DROP COLUMN IF EXISTS "resource_id",
    DROP COLUMN IF EXISTS "resource_type",
    DROP COLUMN IF EXISTS "actor_role",
    DROP COLUMN IF EXISTS "actor_id";

-- 2. Remove processed_events
DROP INDEX IF EXISTS "processed_events_received_at_idx";
DROP TABLE IF EXISTS "processed_events";
