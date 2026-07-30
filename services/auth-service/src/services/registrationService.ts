/**
 * RegistrationService — owns the full register + verify + resend flow.
 *
 * Enumeration safety: identical 202 response for new AND existing emails.
 * Verification tokens are issued AFTER the transaction commits.
 */

import type { CredentialService } from "./credentialService.js";
import type { TokenService } from "./tokenService.js";
import type { Mailer } from "../mail/mailer.js";
import type { DbClient } from "../db/types.js";
import { createUserRepository, UserConflictError } from "../repositories/userRepository.js";
import type { User } from "../models/user.js";

const VERIFICATION_EXPIRY_HOURS = 24;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface RegisterResult {
  /** Always 'accepted' — never reveals whether email existed */
  outcome: "accepted";
}

export interface VerifyEmailResult {
  verified: boolean;
  reason?: "not_found" | "expired" | "already_used";
}

// ─── Service ─────────────────────────────────────────────────────────────────

export interface RegistrationServiceDeps {
  db: DbClient;
  credentialService: CredentialService;
  tokenService: TokenService;
  mailer: Mailer;
  /** Default role name to assign to new accounts */
  defaultRole?: string;
}

export class RegistrationService {
  private readonly users: ReturnType<typeof createUserRepository>;

  constructor(private readonly deps: RegistrationServiceDeps) {
    this.users = createUserRepository(deps.db);
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Password policy check (before any DB work)
    const policy = this.deps.credentialService.validatePasswordPolicy(
      input.password,
      normalizedEmail,
    );
    if (!policy.valid) {
      throw new PolicyViolationError(policy.violations);
    }

    // 2. Attempt to create the user
    let user: User | null = null;
    let isNewUser = false;

    try {
      user = await this.users.create({
        email: normalizedEmail,
        displayName: input.displayName,
        status: "pending",
      });
      isNewUser = true;

      // 3. Hash + store credential (within a "soft transaction" — after user creation)
      const hash = await this.deps.credentialService.hashPassword(input.password);
      await this.deps.db.credential.create({
        data: {
          userId: user.id,
          type: "password",
          secretHash: hash,
          hashAlgorithm: this.deps.credentialService.algorithm,
        },
      });

    } catch (err: unknown) {
      if (err instanceof UserConflictError) {
        // Enumeration-safe: look up existing user silently
        user = await this.users.findByEmail(normalizedEmail);
      } else {
        throw err;
      }
    }

    if (!user) {
      // Should never reach here — return generic accepted
      return { outcome: "accepted" };
    }

    // 4. Issue verification token AFTER any DB writes
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 3600 * 1000);
    const token = await this.deps.tokenService.create({
      userId: user.id,
      purpose: "email_verification",
      expiresAt,
    });

    // 5. Send email — never block/rollback on mailer failure
    try {
      if (isNewUser || user.emailVerifiedAt === null) {
        await this.deps.mailer.sendVerificationEmail({
          to: user.email,
          verificationToken: token,
          displayName: user.displayName ?? undefined,
          expiresInHours: VERIFICATION_EXPIRY_HOURS,
        });
      } else {
        await this.deps.mailer.sendRegistrationAttemptNotice({
          to: user.email,
          displayName: user.displayName ?? undefined,
        });
      }
    } catch {
      // Log mailer failure in a real implementation — for now swallow to keep 202
    }

    return { outcome: "accepted" };
  }

  async verifyEmail(rawToken: string): Promise<VerifyEmailResult> {
    const result = await this.deps.tokenService.consume(rawToken);
    if (!result.ok) {
      return { verified: false, reason: result.reason };
    }

    // Activate the user account
    await this.users.updateStatus(result.userId, "active");
    // Mark email verified (update in db through a direct update)
    await this.deps.db.user.update({
      where: { id: result.userId },
      data: { emailVerifiedAt: new Date() },
    });

    return { verified: true };
  }
}

// ─── Error types ──────────────────────────────────────────────────────────────

export class PolicyViolationError extends Error {
  constructor(public readonly violations: Array<{ rule: string; message: string }>) {
    super("Password policy violations");
    this.name = "PolicyViolationError";
  }
}
