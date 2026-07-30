/**
 * Domain model types for the users table.
 * These mirror the Prisma-generated types but remain stable even if the ORM changes.
 */

export type UserStatus = "active" | "pending" | "suspended" | "deleted";

export interface User {
  id: string;
  /** Normalized lowercase email address */
  email: string;
  emailVerifiedAt: Date | null;
  displayName: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Input type for creating a new user. Email is normalized before storage. */
export interface CreateUserInput {
  email: string;
  displayName?: string;
  status?: UserStatus;
}

export type CredentialType = "password" | "oauth" | "totp";

export interface Credential {
  id: string;
  userId: string;
  type: CredentialType;
  /** Argon2id hash — never the raw secret */
  secretHash: string;
  hashAlgorithm: string;
  failedAttemptCount: number;
  lockedUntil: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCredentialInput {
  userId: string;
  type?: CredentialType;
  secretHash: string;
  hashAlgorithm?: string;
}

export interface Session {
  id: string;
  userId: string;
  /** SHA-256 hash of the opaque refresh token. Raw token is never stored. */
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedFromSessionId: string | null;
}

export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  rotatedFromSessionId?: string;
}
