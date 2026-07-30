/**
 * Migration structure tests — assert that the migration files are well-formed
 * and contain all expected tables, columns, and constraints.
 *
 * These tests run offline (no real database) by parsing the SQL text.
 * For real integration tests against a Postgres instance, run with DATABASE_URL set.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_DIR = join(__dirname, "../../prisma/migrations/0001_identity_schema");

describe("0001_identity_schema forward migration", () => {
  const sql = readFileSync(join(MIGRATION_DIR, "migration.sql"), "utf-8");

  it("creates the users table", () => {
    expect(sql).toContain('CREATE TABLE "users"');
  });

  it("creates the credentials table", () => {
    expect(sql).toContain('CREATE TABLE "credentials"');
  });

  it("creates the sessions table", () => {
    expect(sql).toContain('CREATE TABLE "sessions"');
  });

  it("creates the roles table", () => {
    expect(sql).toContain('CREATE TABLE "roles"');
  });

  it("creates the permissions table", () => {
    expect(sql).toContain('CREATE TABLE "permissions"');
  });

  it("creates the role_permissions join table", () => {
    expect(sql).toContain('CREATE TABLE "role_permissions"');
  });

  it("creates the user_roles join table", () => {
    expect(sql).toContain('CREATE TABLE "user_roles"');
  });

  it("enforces case-insensitive email uniqueness via functional index", () => {
    expect(sql).toContain("lower");
    expect(sql).toContain("users_email_ci_idx");
  });

  it("creates unique index on sessions.refresh_token_hash", () => {
    expect(sql).toContain("sessions_refresh_token_hash_key");
  });

  it("creates index on sessions.user_id", () => {
    expect(sql).toContain("sessions_user_id_idx");
  });

  it("creates index on sessions.expires_at", () => {
    expect(sql).toContain("sessions_expires_at_idx");
  });

  it("creates CASCADE delete from credentials to users", () => {
    expect(sql).toContain("ON DELETE CASCADE");
  });

  it("creates user_roles with composite primary key", () => {
    expect(sql).toContain("user_roles_pkey");
    expect(sql).toContain('"user_id", "role_id"');
  });

  it("defines UserStatus enum", () => {
    expect(sql).toContain("CREATE TYPE \"UserStatus\"");
    expect(sql).toContain("'active'");
    expect(sql).toContain("'pending'");
    expect(sql).toContain("'suspended'");
    expect(sql).toContain("'deleted'");
  });

  it("defines CredentialType enum", () => {
    expect(sql).toContain("CREATE TYPE \"CredentialType\"");
    expect(sql).toContain("'password'");
    expect(sql).toContain("'oauth'");
    expect(sql).toContain("'totp'");
  });
});

describe("0001_identity_schema rollback migration", () => {
  const sql = readFileSync(join(MIGRATION_DIR, "rollback.sql"), "utf-8");

  it("drops all tables", () => {
    expect(sql).toContain("DROP TABLE IF EXISTS");
    expect(sql).toContain("user_roles");
    expect(sql).toContain("credentials");
    expect(sql).toContain("users");
    expect(sql).toContain("sessions");
  });

  it("drops all enum types", () => {
    expect(sql).toContain("DROP TYPE IF EXISTS");
    expect(sql).toContain("CredentialType");
    expect(sql).toContain("UserStatus");
  });

  it("uses CASCADE to handle dependents", () => {
    expect(sql).toContain("CASCADE");
  });
});
