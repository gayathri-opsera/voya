import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_DIR = join(
  import.meta.dirname ?? __dirname,
  "../../prisma/migrations/0001_idempotency_audit_provenance",
);

function loadSql(filename: string): string {
  return readFileSync(join(MIGRATION_DIR, filename), "utf8");
}

describe("migration 0001 - forward SQL", () => {
  const sql = loadSql("migration.sql");

  it("creates processed_events table", () => {
    expect(sql).toMatch(/CREATE TABLE.*processed_events/i);
  });

  it("adds unique constraint on (provider, event_id)", () => {
    expect(sql).toMatch(/UNIQUE.*provider.*event_id|processed_events_provider_event_id_key/i);
  });

  it("adds actor_id and actor_role to booking_audit_log", () => {
    expect(sql).toMatch(/ADD COLUMN.*actor_id/i);
    expect(sql).toMatch(/ADD COLUMN.*actor_role/i);
  });

  it("adds sequence column as identity", () => {
    expect(sql).toMatch(/GENERATED ALWAYS AS IDENTITY/i);
  });

  it("creates append-only trigger", () => {
    expect(sql).toMatch(/CREATE.*TRIGGER.*booking_audit_log/i);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE/i);
    expect(sql).toMatch(/RAISE EXCEPTION/i);
  });

  it("adds provenance and bookable to bookings", () => {
    expect(sql).toMatch(/ADD COLUMN.*provenance/i);
    expect(sql).toMatch(/ADD COLUMN.*bookable/i);
  });

  it("does not drop or rename any existing columns", () => {
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/RENAME COLUMN/i);
  });
});

describe("migration 0001 - rollback SQL", () => {
  const sql = loadSql("rollback.sql");

  it("drops processed_events table", () => {
    expect(sql).toMatch(/DROP TABLE.*processed_events/i);
  });

  it("drops the append-only trigger", () => {
    expect(sql).toMatch(/DROP TRIGGER.*booking_audit_log/i);
  });

  it("removes provenance and bookable columns from bookings", () => {
    expect(sql).toMatch(/DROP COLUMN.*provenance/i);
    expect(sql).toMatch(/DROP COLUMN.*bookable/i);
  });
});
