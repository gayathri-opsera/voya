import { describe, it, expect, beforeEach, vi } from "vitest";
import { LoginService } from "../../src/services/loginService.js";
import { TokenService, createHmacKey } from "../../src/services/jwtService.js";
import type { DbClient } from "../../src/db/types.js";
import type { CredentialService } from "../../src/services/credentialService.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTokenService(): TokenService {
  const key = createHmacKey("test-secret-that-is-long-enough-for-hs256");
  return new TokenService({ signingKey: key, issuer: "iss", audience: "aud", expiresInSeconds: 900 });
}

function makeCredentialService(overrides: Partial<CredentialService> = {}): CredentialService {
  return {
    algorithm: "argon2id",
    hashPassword: vi.fn().mockResolvedValue("$argon2id$hash"),
    verifyPassword: vi.fn().mockResolvedValue({ valid: true, needsRehash: false }),
    validatePasswordPolicy: vi.fn().mockReturnValue({ valid: true }),
    isLocked: vi.fn().mockReturnValue({ locked: false, lockedUntil: null, retryAfterSeconds: 0 }),
    computeLockoutExpiry: vi.fn().mockReturnValue(null),
    ...overrides,
  } as unknown as CredentialService;
}

const BASE_USER = {
  id: "user_1",
  email: "verified@example.com",
  emailVerifiedAt: new Date("2026-01-01"),
  displayName: "Test User",
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BASE_CRED = {
  id: "cred_1",
  userId: "user_1",
  type: "password",
  secretHash: "$argon2id$hash",
  hashAlgorithm: "argon2id",
  failedAttemptCount: 0,
  lockedUntil: null,
  lastUsedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeDb(
  userOverride?: Partial<typeof BASE_USER> | null,
  credOverride?: Partial<typeof BASE_CRED> | null,
): DbClient {
  const user = userOverride === null ? null : { ...BASE_USER, ...userOverride };
  const cred = credOverride === null ? null : { ...BASE_CRED, ...credOverride };

  return {
    user: {
      async create() { return null as never; },
      async findUnique({ where }) {
        if (!user) return null;
        if (where["email"] && user.email === where["email"]) return user as never;
        if (where["id"] && user.id === where["id"]) return user as never;
        return null;
      },
      async update() { return user as never; },
    },
    session: {
      async create({ data }) {
        return {
          id: "session_1",
          userId: data["userId"],
          refreshTokenHash: data["refreshTokenHash"],
          userAgent: data["userAgent"] ?? null,
          ipAddress: data["ipAddress"] ?? null,
          issuedAt: new Date(),
          expiresAt: data["expiresAt"],
          revokedAt: null,
          rotatedFromSessionId: null,
        } as never;
      },
      async findUnique() { return null; },
      async update() { return null as never; },
    },
    credential: {
      async create() { return null as never; },
      async findFirst() { return cred as never; },
      async update() { return cred as never; },
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LoginService — happy path", () => {
  it("returns accessToken for valid credentials on verified account", async () => {
    const svc = new LoginService({
      db: makeDb(),
      credentialService: makeCredentialService(),
      tokenService: makeTokenService(),
    });

    const result = await svc.login({ email: "verified@example.com", password: "SecurePass123!" });

    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("should be success");
    expect(result.accessToken).toBeTruthy();
    expect(result.tokenType).toBe("Bearer");
    expect(result.user.id).toBe("user_1");
    expect(result.user.emailVerified).toBe(true);
  });

  it("normalises email before lookup", async () => {
    const svc = new LoginService({
      db: makeDb(),
      credentialService: makeCredentialService(),
      tokenService: makeTokenService(),
    });

    const result = await svc.login({ email: "VERIFIED@EXAMPLE.COM ", password: "SecurePass123!" });
    expect(result.outcome).toBe("success");
  });
});

describe("LoginService — failure branches", () => {
  it("returns invalid_credentials for unknown email (constant-time)", async () => {
    const credSvc = makeCredentialService();
    const svc = new LoginService({
      db: makeDb(null),
      credentialService: credSvc,
      tokenService: makeTokenService(),
    });

    const result = await svc.login({ email: "unknown@example.com", password: "anything" });
    expect(result.outcome).toBe("invalid_credentials");
    // Dummy verify was called for constant-time behaviour
    expect(credSvc.verifyPassword).toHaveBeenCalled();
  });

  it("returns invalid_credentials for wrong password", async () => {
    const credSvc = makeCredentialService({
      verifyPassword: vi.fn().mockResolvedValue({ valid: false, needsRehash: false }),
    });
    const svc = new LoginService({
      db: makeDb(),
      credentialService: credSvc,
      tokenService: makeTokenService(),
    });

    const result = await svc.login({ email: "verified@example.com", password: "wrongpassword" });
    expect(result.outcome).toBe("invalid_credentials");
  });

  it("returns account_locked when lockout is already active", async () => {
    const credSvc = makeCredentialService({
      isLocked: vi.fn().mockReturnValue({ locked: true, lockedUntil: new Date(), retryAfterSeconds: 300 }),
    });
    const svc = new LoginService({
      db: makeDb(),
      credentialService: credSvc,
      tokenService: makeTokenService(),
    });

    const result = await svc.login({ email: "verified@example.com", password: "SecurePass123!" });
    expect(result.outcome).toBe("account_locked");
    if (result.outcome !== "account_locked") throw new Error("should be locked");
    expect(result.retryAfterSeconds).toBe(300);
  });

  it("returns email_not_verified for unverified accounts", async () => {
    const svc = new LoginService({
      db: makeDb({ emailVerifiedAt: null }),
      credentialService: makeCredentialService(),
      tokenService: makeTokenService(),
    });

    const result = await svc.login({ email: "verified@example.com", password: "SecurePass123!" });
    expect(result.outcome).toBe("email_not_verified");
  });

  it("returns account_disabled for suspended accounts", async () => {
    const svc = new LoginService({
      db: makeDb({ status: "suspended" }),
      credentialService: makeCredentialService(),
      tokenService: makeTokenService(),
    });

    const result = await svc.login({ email: "verified@example.com", password: "SecurePass123!" });
    expect(result.outcome).toBe("account_disabled");
  });

  it("increments failed-attempt counter on wrong password", async () => {
    const db = makeDb();
    const updateSpy = vi.spyOn(db.credential, "update");

    const credSvc = makeCredentialService({
      verifyPassword: vi.fn().mockResolvedValue({ valid: false, needsRehash: false }),
    });

    const svc = new LoginService({ db, credentialService: credSvc, tokenService: makeTokenService() });
    await svc.login({ email: "verified@example.com", password: "wrong" });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedAttemptCount: 1 }),
      }),
    );
  });

  it("resets counter on successful login", async () => {
    const db = makeDb({ ...BASE_USER }, { ...BASE_CRED, failedAttemptCount: 3 });
    const updateSpy = vi.spyOn(db.credential, "update");

    const svc = new LoginService({
      db,
      credentialService: makeCredentialService(),
      tokenService: makeTokenService(),
    });

    await svc.login({ email: "verified@example.com", password: "SecurePass123!" });

    const resetCall = updateSpy.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>)?.["data"]?.["failedAttemptCount"] === 0,
    );
    expect(resetCall).toBeDefined();
  });
});

describe("LoginService — token claims", () => {
  it("minted token contains sid matching the created session", async () => {
    const tokenSvc = makeTokenService();
    const svc = new LoginService({
      db: makeDb(),
      credentialService: makeCredentialService(),
      tokenService: tokenSvc,
    });

    const result = await svc.login({ email: "verified@example.com", password: "SecurePass123!" });
    if (result.outcome !== "success") throw new Error("expected success");

    const verified = tokenSvc.verify(result.accessToken);
    if (!verified.ok) throw new Error("token should verify");
    expect(verified.claims.sub).toBe("user_1");
    expect(verified.claims.sid).toBe("session_1");
  });
});
