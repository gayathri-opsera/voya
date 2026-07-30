/**
 * Minimal data-access interface for repositories.
 * Matches the shape of PrismaClient without requiring the generated client at import time.
 * All repositories accept this interface so they remain testable without a real DB.
 */

export interface UserRow {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  displayName: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CredentialRow {
  id: string;
  userId: string;
  type: string;
  secretHash: string;
  hashAlgorithm: string;
  failedAttemptCount: number;
  lockedUntil: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRow {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedFromSessionId: string | null;
  /** Rotation-family root identifier (copied verbatim on every rotation) */
  familyId: string;
  /** Hard ceiling — never extended by rotation */
  absoluteExpiresAt: Date;
}

export interface DbUserDelegate {
  create(args: { data: Partial<UserRow> }): Promise<UserRow>;
  findUnique(args: { where: Partial<UserRow> & { id?: string; email?: string } }): Promise<UserRow | null>;
  update(args: { where: { id: string }; data: Partial<UserRow> }): Promise<UserRow>;
}

export interface DbSessionDelegate {
  create(args: { data: Partial<SessionRow> }): Promise<SessionRow>;
  findUnique(args: { where: { id?: string; refreshTokenHash?: string } }): Promise<SessionRow | null>;
  update(args: { where: { id: string }; data: Partial<SessionRow> }): Promise<SessionRow>;
  /** Atomic conditional update: sets revokedAt only if currently null. Returns updated row or null (already revoked). */
  updateAtomic(args: { where: { id: string }; data: Partial<SessionRow> }): Promise<SessionRow | null>;
  /** Revoke every active session in a family. */
  revokeFamily(args: { familyId: string }): Promise<number>;
  /** Batch-delete expired and long-revoked sessions. Returns deleted count. */
  deleteExpired(args: { before: Date; revokedBefore?: Date; limit?: number }): Promise<number>;
}

export interface DbCredentialDelegate {
  create(args: { data: Partial<CredentialRow> }): Promise<CredentialRow>;
  findFirst(args: { where: Partial<CredentialRow> }): Promise<CredentialRow | null>;
  update(args: { where: { id: string }; data: Partial<CredentialRow> }): Promise<CredentialRow>;
}

export interface DbClient {
  user: DbUserDelegate;
  session: DbSessionDelegate;
  credential: DbCredentialDelegate;
}
