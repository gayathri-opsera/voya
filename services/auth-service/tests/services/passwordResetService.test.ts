import { describe, it, expect, vi, beforeEach } from "vitest";
import { PasswordResetService } from "../../src/services/passwordResetService.js";
import type { DbClient, CredentialRow, UserRow, SessionRow } from "../../src/db/types.js";
import { InMemoryTokenStore } from "../../src/repositories/tokenRepository.js";
import { TokenService } from "../../src/services/tokenService.js";
import { InMemoryMailer } from "../../src/mail/mailer.js";

const NOW = new Date();
const FUTURE = new Date(NOW.getTime() + 3600_000);

function makeCredential(overrides?: Partial<CredentialRow>): CredentialRow {
  return {
    id: "cred1",
    userId: "u1",
    type: "password",
    secretHash: "$argon2id$...",
    hashAlgorithm: "argon2id",
    failedAttemptCount: 3,
    lockedUntil: FUTURE,
    lastUsedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeUser(overrides?: Partial<UserRow>): UserRow {
  return {
    id: "u1",
    email: "user@example.com",
    emailVerifiedAt: NOW,
    displayName: "Test User",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeDb(sessions: SessionRow[] = []): DbClient {
  const sessionStore = new Map(sessions.map((s) => [s.id, { ...s }]));
  const cred = makeCredential();
  const user = makeUser();

  return {
    user: {
      async create() { return null as never; },
      async findUnique() { return user; },
      async update() { return user; },
    },
    session: {
      async create() { return null as never; },
      async findUnique({ where }) { return sessionStore.get(where.id ?? "") ?? null; },
      async findMany({ where }) {
        return [...sessionStore.values()].filter((s) => !where.userId || s.userId === where.userId);
      },
      async update() { return null as never; },
      async updateAtomic({ where, data }) {
        const row = sessionStore.get(where.id);
        if (!row) return null;
        Object.assign(row, data);
        return row;
      },
      async revokeFamily() { return 0; },
      async deleteExpired() { return 0; },
    },
    credential: {
      async create() { return null as never; },
      async findFirst() { return cred; },
      async update(_args) { return cred; },
    },
  };
}

function makeService(db: DbClient) {
  const tokenStore = new InMemoryTokenStore();
  const tokenService = new TokenService(tokenStore);
  const mailer = new InMemoryMailer();

  // Minimal credentialService mock
  const credentialService = {
    validatePasswordPolicy: (_pw: string, _email: string) => ({ valid: true, violations: [] }),
    hashPassword: async (_pw: string) => "newhash",
    verifyPassword: async (_pw: string, _hash: string) => ({ valid: false, needsRehash: false }),
  };

  const svc = new PasswordResetService({ db, credentialService: credentialService as never, tokenService, mailer });
  return { svc, tokenService, mailer };
}

describe("PasswordResetService - requestReset", () => {
  it("resolves without error for existing email (generic)", async () => {
    const db = makeDb();
    const { svc } = makeService(db);
    await expect(svc.requestReset({ email: "user@example.com" })).resolves.toBeUndefined();
  });

  it("resolves without error for non-existent email (enumeration-safe)", async () => {
    const db = makeDb();
    // Override user lookup to return null
    db.user.findUnique = async () => null;
    const { svc } = makeService(db);
    await expect(svc.requestReset({ email: "nobody@example.com" })).resolves.toBeUndefined();
  });
});

describe("PasswordResetService - resetPassword", () => {
  it("rejects invalid/expired tokens", async () => {
    const db = makeDb();
    const { svc } = makeService(db);
    const result = await svc.resetPassword({ token: "invalid_token", password: "NewPassword1!" });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("invalid_or_expired_token");
  });

  it("rejects password reuse (same hash)", async () => {
    const db = makeDb();
    const { svc, tokenService } = makeService(db);
    // Override verifyPassword to simulate reuse
    const credSvc = {
      validatePasswordPolicy: () => ({ valid: true, violations: [] }),
      hashPassword: async () => "newhash",
      verifyPassword: async () => ({ valid: true, needsRehash: false }),
    };
    const mailer = new InMemoryMailer();
    const tokenStore = new InMemoryTokenStore();
    const ts = new TokenService(tokenStore);
    const svc2 = new PasswordResetService({ db, credentialService: credSvc as never, tokenService: ts, mailer });

    const token = await ts.create({ userId: "u1", purpose: "password_reset", expiresAt: FUTURE });
    const result = await svc2.resetPassword({ token, password: "SamePass1!" });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("password_reuse");
  });

  it("succeeds and revokes all sessions", async () => {
    const activeSessions: SessionRow[] = [
      { id: "s1", userId: "u1", refreshTokenHash: "h1", userAgent: null, ipAddress: null, issuedAt: NOW, expiresAt: FUTURE, revokedAt: null, rotatedFromSessionId: null, familyId: "f1", absoluteExpiresAt: FUTURE },
      { id: "s2", userId: "u1", refreshTokenHash: "h2", userAgent: null, ipAddress: null, issuedAt: NOW, expiresAt: FUTURE, revokedAt: null, rotatedFromSessionId: null, familyId: "f1", absoluteExpiresAt: FUTURE },
    ];
    const db = makeDb(activeSessions);
    const updateSpy = vi.spyOn(db.session, "updateAtomic");
    const { svc, tokenService } = makeService(db);

    const token = await tokenService.create({ userId: "u1", purpose: "password_reset", expiresAt: FUTURE });
    const result = await svc.resetPassword({ token, password: "NewPassword1!" });

    expect(result.ok).toBe(true);
    // Both sessions revoked
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects policy violations", async () => {
    const db = makeDb();
    const tokenStore = new InMemoryTokenStore();
    const ts = new TokenService(tokenStore);
    const mailer = new InMemoryMailer();
    const credSvc = {
      validatePasswordPolicy: () => ({ valid: false, violations: [{ rule: "TOO_SHORT", message: "too short" }] }),
      hashPassword: async () => "newhash",
      verifyPassword: async () => ({ valid: false, needsRehash: false }),
    };
    const svc = new PasswordResetService({ db, credentialService: credSvc as never, tokenService: ts, mailer });

    const token = await ts.create({ userId: "u1", purpose: "password_reset", expiresAt: FUTURE });
    const result = await svc.resetPassword({ token, password: "short" });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("policy_violation");
  });
});
