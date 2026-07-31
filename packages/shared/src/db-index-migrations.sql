## Index Tuning and Audit Log Range Partitioning — WO-077

-- Audit log range partitioning by month for efficient purge
CREATE TABLE audit_log_entries (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    action      TEXT NOT NULL,
    actor_id    TEXT NOT NULL,
    actor_role  TEXT NOT NULL,
    prev_hash   TEXT,
    hash        TEXT NOT NULL,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions (auto-managed by pg_partman in production)
CREATE TABLE audit_log_entries_2026_01 PARTITION OF audit_log_entries
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit_log_entries_2026_02 PARTITION OF audit_log_entries
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Indexes per partition (automatically inherited)
CREATE INDEX ON audit_log_entries (entity_type, entity_id, created_at DESC);
CREATE INDEX ON audit_log_entries (created_at DESC);
CREATE INDEX ON audit_log_entries (actor_id, created_at DESC);

-- Bookings: composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_bookings_user_status
    ON bookings (user_id, status, created_at DESC)
    WHERE status NOT IN ('EXPIRED', 'CANCELLED');

CREATE INDEX CONCURRENTLY idx_bookings_offer_id
    ON bookings (offer_id);

CREATE INDEX CONCURRENTLY idx_bookings_idempotency
    ON bookings (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Payments: index for reconciliation queries
CREATE INDEX CONCURRENTLY idx_payments_booking_id
    ON payments (booking_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_payments_stripe_event
    ON processed_events (event_id);

-- Sessions: index for expiry sweep
CREATE INDEX CONCURRENTLY idx_sessions_expires_at
    ON refresh_tokens (expires_at)
    WHERE revoked = false;

-- Itineraries: user lookup
CREATE INDEX CONCURRENTLY idx_itineraries_user_id
    ON itineraries (user_id, updated_at DESC);
