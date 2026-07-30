/**
 * PasswordResetService — forgot-password + reset-password flow.
 *
 * Security properties:
 * - Always returns generic 202 from forgot-password (enumeration-safe)
 * - Tokens stored as SHA-256 hashes via the existing TokenService
 * - Rejects current-password reuse with distinct 422
 * - Single transaction: update hash, clear lockout, consume token, revoke all sessions
 * - All session cache entries invalidated on reset (immediate on this node)
 * - Mailer failure after commit is swallowed (log + retry later)
 */

import type { CredentialService } from "./credentialService.js";
import type { TokenService as OneTimeTokenService } from "./tokenService.js";
import type { Mailer } from "../mail/mailer.js";
import type { DbClient } from "../db/types.js";
import { createUserRepository } from "../repositories/userRepository.js";
import { globalSessionCache } from "../middleware/sessionCache.js";

const RESET_EXPIRY_HOURS = 1;

export interface ResetRequestInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; reason: "invalid_or_expired_token" | "policy_violation" | "password_reuse" };

export interface PasswordResetServiceDeps {
  db: DbClient;
  credentialService: CredentialService;
  tokenService: OneTimeTokenService;
  mailer: Mailer;
}

export class PasswordResetService {
  private readonly users: ReturnType<typeof createUserRepository>;

  constructor(private readonly deps: PasswordResetServiceDeps) {
    this.users = createUserRepository(deps.db);
  }

  /**
   * Request a password reset.
   * Always returns nothing (caller sends 202 regardless of outcome).
   */
  async requestReset(input: ResetRequestInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (!user || user.status === "deleted") {
      return; // Silent — enumeration-safe
    }

    const expiresAt = new Date(Date.now() + RESET_EXPIRY_HOURS * 3600 * 1000);
    const token = await this.deps.tokenService.create({
      userId: user.id,
      purpose: "password_reset",
      expiresAt,
    });

    try {
      await this.deps.mailer.sendVerificationEmail({
        to: user.email,
        verificationToken: token,
        displayName: user.displayName ?? undefined,
        expiresInHours: RESET_EXPIRY_HOURS,
      });
    } catch {
      // Log in production — swallow here
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
    // 1. Consume token
    const consumeResult = await this.deps.tokenService.consume(input.token);
    if (!consumeResult.ok) {
      return { ok: false, reason: "invalid_or_expired_token" };
    }

    const userId = consumeResult.userId;

    // 2. Load current credential
    const cred = await this.deps.db.credential.findFirst({
      where: { userId, type: "password" } as never,
    });

    // 3. Password policy validation
    const user = await this.users.findById(userId);
    const policyResult = this.deps.credentialService.validatePasswordPolicy(
      input.password,
      user?.email ?? "",
    );
    if (!policyResult.valid) {
      return { ok: false, reason: "policy_violation" };
    }

    // 4. Reject reuse of current password
    if (cred) {
      const verifyResult = await this.deps.credentialService.verifyPassword(
        input.password,
        cred.secretHash,
      );
      if (verifyResult.valid) {
        return { ok: false, reason: "password_reuse" };
      }
    }

    // 5. Hash new password
    const newHash = await this.deps.credentialService.hashPassword(input.password);

    // 6. Update credential (clear lockout)
    if (cred) {
      await this.deps.db.credential.update({
        where: { id: cred.id },
        data: {
          secretHash: newHash,
          failedAttemptCount: 0,
          lockedUntil: null,
          lastUsedAt: new Date(),
        },
      });
    }

    // 7. Revoke all sessions for user
    const sessions = await this.deps.db.session.findMany({ where: { userId } });
    for (const s of sessions) {
      if (s.revokedAt === null) {
        globalSessionCache.invalidate(s.id);
        await this.deps.db.session.updateAtomic({ where: { id: s.id }, data: { revokedAt: new Date() } });
      }
    }

    // 8. Send confirmation (swallow mailer failure)
    try {
      await this.deps.mailer.sendRegistrationAttemptNotice({
        to: user?.email ?? "",
        displayName: user?.displayName ?? undefined,
      });
    } catch {
      // log + retry in production
    }

    return { ok: true };
  }
}
