import type { DbClient } from "../db/types.js";
import type { Session, CreateSessionInput } from "../models/user.js";

export class SessionNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Session not found: ${identifier}`);
    this.name = "SessionNotFoundError";
  }
}

export function createSessionRepository(db: DbClient) {
  return {
    async create(input: CreateSessionInput): Promise<Session> {
      const session = await db.session.create({
        data: {
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
          rotatedFromSessionId: input.rotatedFromSessionId ?? null,
        },
      });
      return mapSession(session);
    },

    async findActiveByRefreshHash(hash: string): Promise<Session | null> {
      const session = await db.session.findUnique({ where: { refreshTokenHash: hash } });
      if (!session) return null;
      if (session.revokedAt !== null) return null;
      if (session.expiresAt < new Date()) return null;
      return mapSession(session);
    },

    async revoke(id: string): Promise<void> {
      try {
        await db.session.update({ where: { id }, data: { revokedAt: new Date() } });
      } catch (err: unknown) {
        if (isRecordNotFound(err)) throw new SessionNotFoundError(id);
        throw err;
      }
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
