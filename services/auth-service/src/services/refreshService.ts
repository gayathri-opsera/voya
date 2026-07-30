/**
 * RefreshService — implements strict one-time-use refresh token rotation.
 *
 * Security properties:
 * - Each refresh consumes the presented token and issues a new one (linked via
 *   rotated_from_session_id and sharing a family_id).
 * - Reuse of an already-consumed token triggers full family revocation and
 *   a HIGH-severity security event.
 * - Atomic rotation prevents two concurrent requests from both succeeding.
 * - Absolute session lifetime is never extended by rotation.
 * - Raw refresh tokens are never stored or logged.
 */

import { randomBytes } from "crypto";
import {
  createSessionRepository,
  generateRefreshToken,
  hashRefreshToken,
} from "../repositories/sessionRepository.js";
import type { TokenService } from "./jwtService.js";
import type { DbClient } from "../db/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RefreshInput {
  /** Raw refresh token (from cookie or body) */
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface RefreshSuccess {
  outcome: "success";
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshToken: string;
}

export type RefreshError =
  | { outcome: "invalid_refresh_token" }
  | { outcome: "refresh_token_reused"; familyId: string }
  | { outcome: "session_expired" };

export type RefreshResult = RefreshSuccess | RefreshError;

export interface RefreshServiceDeps {
  db: DbClient;
  tokenService: TokenService;
  /** Idle session TTL in seconds (default 1,209,600 = 14 days) */
  idleExpirySeconds?: number;
  /** Role loader — defaults to ["user"] */
  loadRoles?: (userId: string) => Promise<string[]>;
  /** Security event emitter (for logging reuse events) */
  onReuseDetected?: (event: {
    userId: string;
    familyId: string;
    ipAddress?: string;
    userAgent?: string;
  }) => void;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class RefreshService {
  private readonly sessions: ReturnType<typeof createSessionRepository>;
  private readonly idleExpiry: number;

  constructor(private readonly deps: RefreshServiceDeps) {
    this.sessions = createSessionRepository(deps.db);
    this.idleExpiry = deps.idleExpirySeconds ?? 1_209_600;
  }

  async refresh(input: RefreshInput): Promise<RefreshResult> {
    // Basic input validation
    if (!input.refreshToken || input.refreshToken.length > 512) {
      return { outcome: "invalid_refresh_token" };
    }

    const hash = hashRefreshToken(input.refreshToken);

    // Look up by hash (includes revoked rows for reuse detection)
    const session = await this.sessions.findByRefreshHash(hash);

    if (!session) {
      return { outcome: "invalid_refresh_token" };
    }

    // ── Reuse detection: token was already rotated/revoked ──────────────────
    if (session.revokedAt !== null) {
      // Revoke the entire family — token may have been stolen
      const row = await this.deps.db.session.findUnique({ where: { id: session.id } });
      const familyId = (row as Record<string, unknown>)?.["familyId"] as string | undefined ?? session.id;

      await this.sessions.revokeFamily(familyId);

      this.deps.onReuseDetected?.({
        userId: session.userId,
        familyId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      return { outcome: "refresh_token_reused", familyId };
    }

    // ── Expiry checks ────────────────────────────────────────────────────────
    const now = new Date();

    // Idle expiry
    if (session.expiresAt < now) {
      return { outcome: "session_expired" };
    }

    // Absolute expiry
    const row = await this.deps.db.session.findUnique({ where: { id: session.id } });
    const absoluteExpiresAt = (row as Record<string, unknown>)?.["absoluteExpiresAt"] as Date | undefined;
    const familyId = (row as Record<string, unknown>)?.["familyId"] as string | undefined ?? session.id;

    if (absoluteExpiresAt && absoluteExpiresAt < now) {
      return { outcome: "session_expired" };
    }

    // ── Atomic rotation ──────────────────────────────────────────────────────
    const newRawToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRawToken);
    const newIdleExpiry = new Date(now.getTime() + this.idleExpiry * 1000);

    const newSession = await this.sessions.rotate({
      oldSessionId: session.id,
      userId: session.userId,
      familyId,
      newRefreshTokenHash: newHash,
      idleExpiresAt: newIdleExpiry,
      absoluteExpiresAt: absoluteExpiresAt ?? newIdleExpiry,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    if (!newSession) {
      // Lost the atomic rotation race
      return { outcome: "invalid_refresh_token" };
    }

    // ── Mint access token ────────────────────────────────────────────────────
    const roles = await (this.deps.loadRoles?.(session.userId) ?? Promise.resolve(["user"]));
    const { token, expiresIn } = this.deps.tokenService.mint({
      userId: session.userId,
      sessionId: newSession.id,
      roles,
    });

    return {
      outcome: "success",
      accessToken: token,
      tokenType: "Bearer",
      expiresIn,
      refreshToken: newRawToken,
    };
  }
}

// ─── Cleanup job ──────────────────────────────────────────────────────────────

export interface SessionCleanupDeps {
  db: DbClient;
  batchSize?: number;
  /** Sessions expired before this date are deleted (default: now) */
  expiredBefore?: Date;
  /** Revoked sessions older than this are deleted (default: 30 days ago) */
  revokedBefore?: Date;
}

export async function runSessionCleanup(deps: SessionCleanupDeps): Promise<number> {
  const sessions = createSessionRepository(deps.db);
  const expiredBefore = deps.expiredBefore ?? new Date();
  const revokedBefore = deps.revokedBefore ?? new Date(Date.now() - 30 * 24 * 3600 * 1000);

  return sessions.deleteExpired({
    before: expiredBefore,
    revokedBefore,
    limit: deps.batchSize ?? 1000,
  });
}
