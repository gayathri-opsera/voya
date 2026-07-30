/**
 * One-time token service — generates, stores (hashed), and consumes verification tokens.
 *
 * Security properties:
 * - 32 random bytes → base64url encoded → 43-char token  (high entropy)
 * - Only SHA-256 hash stored in DB; raw token never persisted
 * - Atomic consume: marks consumed_at in one UPDATE; concurrent reuse races return invalid
 * - All outstanding tokens for a user/purpose are invalidated on consumption
 */

import { randomBytes, createHash } from "crypto";

export type TokenPurpose = "email_verification" | "password_reset";

export interface TokenRow {
  id: string;
  userId: string;
  purpose: TokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface CreateTokenInput {
  userId: string;
  purpose: TokenPurpose;
  expiresAt: Date;
}

export interface TokenStore {
  create(input: CreateTokenInput & { tokenHash: string }): Promise<TokenRow>;
  findByHash(hash: string): Promise<TokenRow | null>;
  markConsumed(id: string): Promise<boolean>;
  invalidateAllForUser(userId: string, purpose: TokenPurpose): Promise<void>;
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "already_used" };

export class TokenService {
  constructor(private readonly store: TokenStore) {}

  /** Generate a 32-byte cryptographically random token and store only its hash. */
  async create(input: CreateTokenInput): Promise<string> {
    const rawToken = randomBytes(32).toString("base64url");
    const hash = sha256(rawToken);
    await this.store.create({ ...input, tokenHash: hash });
    return rawToken;
  }

  /** Consume a token atomically. Returns ok + userId on success, reason on failure. */
  async consume(rawToken: string): Promise<ConsumeResult> {
    const hash = sha256(rawToken);
    const row = await this.store.findByHash(hash);

    if (!row) return { ok: false, reason: "not_found" };
    if (row.consumedAt !== null) return { ok: false, reason: "already_used" };
    if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };

    const consumed = await this.store.markConsumed(row.id);
    if (!consumed) return { ok: false, reason: "already_used" };

    // Invalidate all other outstanding tokens for this user/purpose
    await this.store.invalidateAllForUser(row.userId, row.purpose);

    return { ok: true, userId: row.userId };
  }
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
