import { randomBytes, createHash } from "crypto";
import type { DbClient } from "../db/types.js";
import type { Session, CreateSessionInput } from "../models/user.js";

export class SessionNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Session not found: ${identifier}`);
    this.name = "SessionNotFoundError";
  }
}

// ─── Refresh token helpers ─────────────────────────────────────────────────

/** Generates a 32-byte cryptographically random opaque refresh token. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Returns the SHA-256 hex digest used for DB storage. */
export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

// ─── Extended session input ────────────────────────────────────────────────

export interface CreateSessionForLoginInput extends CreateSessionInput {
  familyId?: string;
  absoluteExpiresAt: Date;
}

export interface RotateSessionInput {
  oldSessionId: string;
  userId: string;
  familyId: string;
  newRefreshTokenHash: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export function createSessionRepository(db: DbClient) {
  return {
    async create(input: CreateSessionInput): Promise<Session> {
      const absoluteExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const session = await db.session.create({
        data: {
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
          rotatedFromSessionId: input.rotatedFromSessionId ?? null,
          familyId: input.userId, // placeholder — overridden by createForLogin
          absoluteExpiresAt,
        },
      });
      return mapSession(session);
    },

    /** Create a session at login, setting the family root. */
    async createForLogin(input: CreateSessionForLoginInput): Promise<Session> {
      const session = await db.session.create({
        data: {
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
          rotatedFromSessionId: null,
          absoluteExpiresAt: input.absoluteExpiresAt,
          // familyId will be set in a follow-up update after we know the session id
        },
      });
      // Set family_id = session.id (root of family)
      const familyId = input.familyId ?? session.id;
      const updated = await db.session.update({
        where: { id: session.id },
        data: { familyId },
      });
      return mapSession(updated);
    },

    async findByRefreshHash(hash: string): Promise<Session | null> {
      const session = await db.session.findUnique({ where: { refreshTokenHash: hash } });
      return session ? mapSession(session) : null;
    },

    async findActiveByRefreshHash(hash: string): Promise<Session | null> {
      const session = await db.session.findUnique({ where: { refreshTokenHash: hash } });
      if (!session) return null;
      if (session.revokedAt !== null) return null;
      if (session.expiresAt < new Date()) return null;
      return mapSession(session);
    },

    /**
     * Atomically rotate: revoke old session (only if not already revoked),
     * create new session with rotated_from_session_id and same family/absolute expiry.
     * Returns null if the old session was already revoked (concurrent rotation).
     */
    async rotate(input: RotateSessionInput): Promise<Session | null> {
      const revoked = await db.session.updateAtomic({
        where: { id: input.oldSessionId },
        data: { revokedAt: new Date() },
      });
      if (!revoked) return null; // lost the race

      const newSession = await db.session.create({
        data: {
          userId: input.userId,
          refreshTokenHash: input.newRefreshTokenHash,
          expiresAt: input.idleExpiresAt,
          absoluteExpiresAt: input.absoluteExpiresAt,
          familyId: input.familyId,
          rotatedFromSessionId: input.oldSessionId,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
        },
      });
      return mapSession(newSession);
    },

    /** Revoke all active sessions in a family (theft detection). Returns count. */
    async revokeFamily(familyId: string): Promise<number> {
      return db.session.revokeFamily({ familyId });
    },

    async revoke(id: string): Promise<void> {
      try {
        await db.session.update({ where: { id }, data: { revokedAt: new Date() } });
      } catch (err: unknown) {
        if (isRecordNotFound(err)) throw new SessionNotFoundError(id);
        throw err;
      }
    },

    /** Batch-delete expired and long-revoked sessions. */
    async deleteExpired(opts: { before: Date; revokedBefore?: Date; limit?: number }): Promise<number> {
      return db.session.deleteExpired(opts);
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapSession(raw: {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedFromSessionId: string | null;
  familyId?: string;
  absoluteExpiresAt?: Date;
}): Session {
  return {
    id: raw.id,
    userId: raw.userId,
    refreshTokenHash: raw.refreshTokenHash,
    userAgent: raw.userAgent,
    ipAddress: raw.ipAddress,
    issuedAt: raw.issuedAt,
    expiresAt: raw.expiresAt,
    revokedAt: raw.revokedAt,
    rotatedFromSessionId: raw.rotatedFromSessionId,
  };
}

function isRecordNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2025"
  );
}
