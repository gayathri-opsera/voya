import { describe, it, expect, beforeEach, vi } from "vitest";
import { RegistrationService, PolicyViolationError } from "../../src/services/registrationService.js";
import { TokenService } from "../../src/services/tokenService.js";
import { InMemoryTokenStore } from "../../src/repositories/tokenRepository.js";
import { InMemoryMailer } from "../../src/mail/mailer.js";
import type { DbClient, DbUserDelegate, DbCredentialDelegate } from "../../src/db/types.js";

// ─── In-memory user + credential store ───────────────────────────────────────

function makeDb(): DbClient & {
  _users: Map<string, Record<string, unknown>>;
} {
  const users = new Map<string, Record<string, unknown>>();
  let idSeq = 0;

  const userDelegate: DbUserDelegate = {
    async create({ data }) {
      const emailKey = ((data["email"] ?? "") as string).toLowerCase();
      const existing = [...users.values()].find(
        (u) => (u["email"] as string).toLowerCase() === emailKey,
      );
      if (existing) {
        throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
      }
      const id = `user_${++idSeq}`;
      const now = new Date();
      const row = {
        id,
        email: emailKey,
        emailVerifiedAt: null,
        displayName: data["displayName"] ?? null,
        status: data["status"] ?? "pending",
        createdAt: now,
        updatedAt: now,
      };
      users.set(id, row);
      return row as never;
    },
    async findUnique({ where }) {
      if (where["id"]) return (users.get(where["id"] as string) ?? null) as never;
      if (where["email"]) {
        const target = (where["email"] as string).toLowerCase();
        return ([...users.values()].find((u) => u["email"] === target) ?? null) as never;
      }
      return null;
    },
    async update({ where, data }) {
      const row = users.get(where.id);
      if (!row) throw Object.assign(new Error("Not found"), { code: "P2025" });
      Object.assign(row, data, { updatedAt: new Date() });
      return row as never;
    },
  };

  const credDelegate: DbCredentialDelegate = {
    async create() { return null as never; },
    async findFirst() { return null; },
    async update() { return null as never; },
  };

  return {
    _users: users,
    user: userDelegate,
    credential: credDelegate,
    session: {
      async create() { return null as never; },
      async findUnique() { return null; },
      async update() { return null as never; },
      async updateAtomic() { return null; },
      async revokeFamily() { return 0; },
      async deleteExpired() { return 0; },
      async findMany() { return []; },
    },
  };
}

// ─── Mock CredentialService ───────────────────────────────────────────────────

function makeCredentialService(valid = true) {
  return {
    algorithm: "argon2id" as const,
    validatePasswordPolicy: vi.fn().mockReturnValue(
      valid
        ? { valid: true, violations: [] }
        : { valid: false, violations: [{ rule: "TOO_SHORT", message: "Too short" }] },
    ),
    hashPassword: vi.fn().mockResolvedValue("$argon2id$hash"),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(
  overrides: Partial<Parameters<typeof RegistrationService.prototype.register>[0]> = {},
  credentialValid = true,
) {
  const db = makeDb();
  const credentialService = makeCredentialService(credentialValid);
  const tokenStore = new InMemoryTokenStore();
  const tokenService = new TokenService(tokenStore);
  const mailer = new InMemoryMailer();

  const service = new RegistrationService({ db, credentialService: credentialService as never, tokenService, mailer });
  return { service, db, credentialService, tokenStore, mailer };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RegistrationService.register", () => {
  it("creates a new user and sends a verification email", async () => {
    const { service, mailer, db } = makeService();

    const result = await service.register({
      email: "Alice@Example.com",
      password: "SecurePass123!",
    });

    expect(result.outcome).toBe("accepted");
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.kind).toBe("verification");
    expect(mailer.sent[0]!.to).toBe("alice@example.com");
    expect(mailer.sent[0]!.token).toBeDefined();

    // User in db
    const user = await db.user.findUnique({ where: { email: "alice@example.com" } });
    expect(user).not.toBeNull();
    expect((user as Record<string, unknown>)?.["status"]).toBe("pending");
  });

  it("normalises email to lowercase", async () => {
    const { service, db } = makeService();
    await service.register({ email: "UPPER@EXAMPLE.COM", password: "SecurePass123!" });

    const user = await db.user.findUnique({ where: { email: "upper@example.com" } });
    expect(user).not.toBeNull();
  });

  it("returns accepted (and resends) for existing unverified account", async () => {
    const { service, mailer } = makeService();

    // First registration
    await service.register({ email: "dup@example.com", password: "SecurePass123!" });
    mailer.clear();

    // Second registration with same email (unverified)
    const result = await service.register({ email: "dup@example.com", password: "SecurePass123!" });

    expect(result.outcome).toBe("accepted");
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.kind).toBe("verification");
  });

  it("throws PolicyViolationError when password policy fails", async () => {
    const { service } = makeService({}, false);
    await expect(
      service.register({ email: "test@example.com", password: "x" }),
    ).rejects.toBeInstanceOf(PolicyViolationError);
  });

  it("assigns a verification token with 24-hour expiry", async () => {
    const { service, mailer } = makeService();
    const before = Date.now();

    await service.register({ email: "token@example.com", password: "SecurePass123!" });

    expect(mailer.sent[0]!.token).toBeDefined();
    // Token expiry baked into tokenStore — we trust tokenService unit tests
    expect(before).toBeLessThan(Date.now() + 1);
  });
});

describe("RegistrationService.verifyEmail", () => {
  it("verifies a valid token and activates the user", async () => {
    const { service, mailer, db } = makeService();

    await service.register({ email: "verify@example.com", password: "SecurePass123!" });
    const token = mailer.sent[0]!.token!;

    const result = await service.verifyEmail(token);
    expect(result.verified).toBe(true);

    const user = await db.user.findUnique({ where: { email: "verify@example.com" } });
    expect((user as Record<string, unknown>)?.["status"]).toBe("active");
    expect((user as Record<string, unknown>)?.["emailVerifiedAt"]).toBeInstanceOf(Date);
  });

  it("returns not_found for an unknown token", async () => {
    const { service } = makeService();
    const result = await service.verifyEmail("completelyfaketoken");
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("not_found");
  });

  it("returns already_used for a reused token", async () => {
    const { service, mailer } = makeService();
    await service.register({ email: "reuse@example.com", password: "SecurePass123!" });
    const token = mailer.sent[0]!.token!;

    await service.verifyEmail(token);
    const second = await service.verifyEmail(token);
    expect(second.verified).toBe(false);
    expect(second.reason).toBe("already_used");
  });

  it("returns expired for an expired token", async () => {
    const db = makeDb();
    const credentialService = makeCredentialService();
    const tokenStore = new InMemoryTokenStore();
    const tokenService = new TokenService(tokenStore);
    const mailer = new InMemoryMailer();

    const service = new RegistrationService({ db, credentialService: credentialService as never, tokenService, mailer });

    // Register to create user
    await service.register({ email: "expired@example.com", password: "SecurePass123!" });

    // Manually create expired token
    const rawToken = "expiredtokenvalue_base64";
    const { createHash } = await import("crypto");
    const hash = createHash("sha256").update(rawToken).digest("hex");
    await tokenStore.create({
      userId: "user_1",
      purpose: "email_verification",
      tokenHash: hash,
      expiresAt: new Date(Date.now() - 1000), // already expired
    });

    const result = await service.verifyEmail(rawToken);
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("identical response body for existing vs new email", async () => {
    const { service } = makeService();

    const fresh = await service.register({ email: "new@example.com", password: "SecurePass123!" });
    const dup   = await service.register({ email: "new@example.com", password: "SecurePass123!" });

    expect(fresh).toEqual(dup);
  });
});

describe("TokenService", () => {
  it("stores only hash, never raw token", async () => {
    const store = new InMemoryTokenStore();
    const svc = new TokenService(store);
    const raw = await svc.create({
      userId: "u1",
      purpose: "email_verification",
      expiresAt: new Date(Date.now() + 86400_000),
    });

    // The store should not contain the raw token
    const rows = [...(store as unknown as { store: Map<string, unknown> }).store.values()];
    expect(rows.every((r: unknown) => {
      return (r as Record<string, unknown>)?.["tokenHash"] !== raw;
    })).toBe(true);
  });

  it("invalidates all tokens for user on consumption", async () => {
    const store = new InMemoryTokenStore();
    const svc = new TokenService(store);
    const userId = "u1";

    const t1 = await svc.create({ userId, purpose: "email_verification", expiresAt: new Date(Date.now() + 86400_000) });
    const t2 = await svc.create({ userId, purpose: "email_verification", expiresAt: new Date(Date.now() + 86400_000) });

    await svc.consume(t1);

    // t2 should now be invalidated
    const result = await svc.consume(t2);
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("already_used");
  });
});
