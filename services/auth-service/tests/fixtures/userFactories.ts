/**
 * Test factories for synthetic identity data.
 * All data is synthetic — no real PII. BR-18 compliant.
 */

import type { CreateUserInput, CreateSessionInput, CreateCredentialInput } from "../../src/models/user.js";

let seq = 0;
const next = () => ++seq;

export function buildUser(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  const n = next();
  return {
    email: `test.user.${n}@voya-test.internal`,
    displayName: `Test User ${n}`,
    status: "pending",
    ...overrides,
  };
}

export function buildAdminUser(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  const n = next();
  return {
    email: `admin.${n}@voya-test.internal`,
    displayName: `Admin ${n}`,
    status: "active",
    ...overrides,
  };
}

export function buildVerifiedUser(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  const n = next();
  return {
    email: `verified.${n}@voya-test.internal`,
    displayName: `Verified User ${n}`,
    status: "active",
    ...overrides,
  };
}

export function buildLockedUser(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  const n = next();
  return {
    email: `locked.${n}@voya-test.internal`,
    displayName: `Locked User ${n}`,
    status: "suspended",
    ...overrides,
  };
}

export function buildSession(userId: string, overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  const n = next();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  return {
    userId,
    refreshTokenHash: `synthetic_hash_${n}_abcdef1234567890abcdef1234567890abcdef12`,
    expiresAt,
    userAgent: "Mozilla/5.0 (compatible; Voya-Test/1.0)",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

export function buildExpiredSession(userId: string): CreateSessionInput {
  return buildSession(userId, {
    expiresAt: new Date(Date.now() - 1000), // already expired
  });
}

export function buildCredential(userId: string, overrides: Partial<CreateCredentialInput> = {}): CreateCredentialInput {
  return {
    userId,
    type: "password",
    secretHash: "$argon2id$v=19$m=65536,t=3,p=4$syntheticSalt$syntheticHashForTesting",
    hashAlgorithm: "argon2id",
    ...overrides,
  };
}
