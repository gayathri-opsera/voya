-- Migration: 0002_verification_tokens
-- One-time token store for email verification and password reset.

CREATE TYPE "TokenPurpose" AS ENUM ('email_verification', 'password_reset');

CREATE TABLE "verification_tokens" (
    "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
    "user_id"      UUID           NOT NULL,
    "purpose"      "TokenPurpose" NOT NULL,
    "token_hash"   VARCHAR(64)    NOT NULL,
    "expires_at"   TIMESTAMPTZ    NOT NULL,
    "consumed_at"  TIMESTAMPTZ,
    "created_at"   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verification_tokens_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "verification_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "verification_tokens_user_id_idx"     ON "verification_tokens"("user_id");
CREATE INDEX "verification_tokens_expires_at_idx"  ON "verification_tokens"("expires_at");
