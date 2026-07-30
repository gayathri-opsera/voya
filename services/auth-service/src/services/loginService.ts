/**
 * LoginService — ordered policy pipeline:
 *   normalize email → load user+credential → lockout check → verify password
 *   → verification check → status check → create session → mint token → reset counters
 *
 * Non-enumerating: unknown email and wrong password both produce invalid_credentials.
 */

import { randomBytes } from "crypto";
import type { CredentialService } from "./credentialService.js";
import type { TokenService, MintTokenInput } from "./jwtService.js";
import { createUserRepository } from "../repositories/userRepository.js";
import { createSessionRepository } from "../repositories/sessionRepository.js";
import type { DbClient } from "../db/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginSuccess {
  outcome: "success";
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    roles: string[];
    emailVerified: boolean;
  };
}

export type LoginError =
  | { outcome: "invalid_credentials" }
  | { outcome: "account_locked"; retryAfterSeconds: number }
  | { outcome: "email_not_verified" }
  | { outcome: "account_disabled" };

export type LoginResult = LoginSuccess | LoginError;

export interface LoginServiceDeps {
  db: DbClient;
  credentialService: CredentialService;
  tokenService: TokenService;
  /** Max failed attempts before lockout (default 5) */
  lockoutThreshold?: number;
  /** Session TTL in seconds (default 604800 = 7 days) */
  sessionExpirySeconds?: number;
}

// ─── Constant-time dummy hash for unknown emails ──────────────────────────────

const DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$dummysaltdummysalt$dummyhashvaluedummy";

// ─── Service ─────────────────────────────────────────────────────────────────

export class LoginService {
  private readonly users: ReturnType<typeof createUserRepository>;
  private readonly sessions: ReturnType<typeof createSessionRepository>;
  private readonly lockoutThreshold: number;

  constructor(private readonly deps: LoginServiceDeps) {
    this.users = createUserRepository(deps.db);
    this.sessions = createSessionRepository(deps.db);
    this.lockoutThreshold = deps.lockoutThreshold ?? 5;
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const sessionExpiry = this.deps.sessionExpirySeconds ?? 604800;

    // 1. Load user
    const user = await this.users.findByEmail(email);

    if (!user) {
      // Constant-time dummy verify to prevent timing enumeration
      await this.deps.credentialService
        .verifyPassword(input.password, DUMMY_HASH)
        .catch(() => undefined);
      return { outcome: "invalid_credentials" };
    }

    // 2. Load credential
    const credRow = await this.deps.db.credential.findFirst({
      where: { userId: user.id, type: "password" } as never,
    });

    if (!credRow) {
      await this.deps.credentialService
        .verifyPassword(input.password, DUMMY_HASH)
        .catch(() => undefined);
      return { outcome: "invalid_credentials" };
    }

    // 3. Lockout check BEFORE hashing work
    const lockoutInfo = this.deps.credentialService.isLocked(
      credRow.failedAttemptCount,
      credRow.lockedUntil,
    );

    if (lockoutInfo.locked) {
      return { outcome: "account_locked", retryAfterSeconds: lockoutInfo.retryAfterSeconds };
    }

    // 4. Verify password
    let verifyResult: { valid: boolean; needsRehash: boolean };
    try {
      verifyResult = await this.deps.credentialService.verifyPassword(
        input.password,
        credRow.secretHash,
      );
    } catch {
      return { outcome: "invalid_credentials" };
    }

    if (!verifyResult.valid) {
      // Increment failed attempts and compute new lockout expiry
      const newFailedCount = credRow.failedAttemptCount + 1;
      const newLockedUntil = this.deps.credentialService.computeLockoutExpiry(
        newFailedCount,
        this.lockoutThreshold,
      );

      await this.deps.db.credential.update({
        where: { id: credRow.id },
        data: {
          failedAttemptCount: newFailedCount,
          lockedUntil: newLockedUntil,
        },
      });

      if (newLockedUntil) {
        const retryAfterSeconds = Math.ceil((newLockedUntil.getTime() - Date.now()) / 1000);
        return { outcome: "account_locked", retryAfterSeconds };
      }

      return { outcome: "invalid_credentials" };
    }

    // 5. Email verified check
    if (!user.emailVerifiedAt) {
      return { outcome: "email_not_verified" };
    }

    // 6. Account status check
    if (user.status !== "active") {
      return { outcome: "account_disabled" };
    }

    // 7. Create session
    const expiresAt = new Date(Date.now() + sessionExpiry * 1000);
    const session = await this.sessions.create({
      userId: user.id,
      refreshTokenHash: randomBytes(32).toString("hex"), // placeholder; WO-022 adds real refresh tokens
      expiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    // 8. Mint access token
    const roles = await this.loadUserRoles(user.id);
    const mintInput: MintTokenInput = {
      userId: user.id,
      sessionId: session.id,
      roles,
    };
    const { token, expiresIn } = this.deps.tokenService.mint(mintInput);

    // 9. Reset failed-attempt counter + update last_used_at
    await this.deps.db.credential.update({
      where: { id: credRow.id },
      data: {
        failedAttemptCount: 0,
        lockedUntil: null,
        lastUsedAt: new Date(),
      },
    });

    // 10. Transparent rehash if needed (don't block response)
    if (verifyResult.needsRehash) {
      this.deps.credentialService
        .hashPassword(input.password)
        .then((newHash) =>
          this.deps.db.credential.update({
            where: { id: credRow.id },
            data: { secretHash: newHash },
          }),
        )
        .catch(() => undefined);
    }

    return {
      outcome: "success",
      accessToken: token,
      tokenType: "Bearer",
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles,
        emailVerified: true,
      },
    };
  }

  private async loadUserRoles(_userId: string): Promise<string[]> {
    // Role loading will be wired in WO-022 when RBAC is fully implemented.
    return ["user"];
  }
}
