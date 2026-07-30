-- Migration: 0001_identity_schema
-- Creates the foundational identity tables for user, credential, session, and RBAC.
-- All objects in this migration are covered by the corresponding rollback.

-- ─── Enum types ────────────────────────────────────────────────────────────────

CREATE TYPE "UserStatus" AS ENUM ('active', 'pending', 'suspended', 'deleted');
CREATE TYPE "CredentialType" AS ENUM ('password', 'oauth', 'totp');

-- ─── users ────────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "email"             VARCHAR(320) NOT NULL,
    "email_verified_at" TIMESTAMPTZ,
    "display_name"      VARCHAR(200),
    "status"            "UserStatus" NOT NULL DEFAULT 'pending',
    "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Case-insensitive uniqueness at the database level.
-- Application code must also normalise email to lower-case before insert/lookup.
CREATE UNIQUE INDEX "users_email_ci_idx" ON "users" (lower("email"));

-- ─── credentials ──────────────────────────────────────────────────────────────

CREATE TABLE "credentials" (
    "id"                   UUID             NOT NULL DEFAULT gen_random_uuid(),
    "user_id"              UUID             NOT NULL,
    "type"                 "CredentialType" NOT NULL DEFAULT 'password',
    "secret_hash"          TEXT             NOT NULL,
    "hash_algorithm"       VARCHAR(50)      NOT NULL DEFAULT 'argon2id',
    "failed_attempt_count" INTEGER          NOT NULL DEFAULT 0,
    "locked_until"         TIMESTAMPTZ,
    "last_used_at"         TIMESTAMPTZ,
    "created_at"           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credentials_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "credentials_user_id_idx" ON "credentials"("user_id");

-- ─── sessions ─────────────────────────────────────────────────────────────────

CREATE TABLE "sessions" (
    "id"                       UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"                  UUID        NOT NULL,
    "refresh_token_hash"       VARCHAR(64) NOT NULL,
    "user_agent"               VARCHAR(1000),
    "ip_address"               VARCHAR(45),
    "issued_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expires_at"               TIMESTAMPTZ NOT NULL,
    "revoked_at"               TIMESTAMPTZ,
    "rotated_from_session_id"  UUID,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "sessions_rotated_from_fkey"
        FOREIGN KEY ("rotated_from_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- ─── roles ────────────────────────────────────────────────────────────────────

CREATE TABLE "roles" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "roles_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "roles_name_key"  UNIQUE ("name")
);

-- ─── permissions ──────────────────────────────────────────────────────────────

CREATE TABLE "permissions" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "permissions_pkey"     PRIMARY KEY ("id"),
    CONSTRAINT "permissions_name_key" UNIQUE ("name")
);

-- ─── role_permissions ─────────────────────────────────────────────────────────

CREATE TABLE "role_permissions" (
    "role_id"       UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey"
        PRIMARY KEY ("role_id", "permission_id"),
    CONSTRAINT "role_permissions_role_id_fkey"
        FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
    CONSTRAINT "role_permissions_permission_id_fkey"
        FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
);

-- ─── user_roles ────────────────────────────────────────────────────────────────

CREATE TABLE "user_roles" (
    "user_id"     UUID        NOT NULL,
    "role_id"     UUID        NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "user_roles_pkey"
        PRIMARY KEY ("user_id", "role_id"),
    CONSTRAINT "user_roles_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_roles_role_id_fkey"
        FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
);

CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");
