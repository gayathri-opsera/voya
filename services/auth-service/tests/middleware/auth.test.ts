import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  parseBearerToken,
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  requireRoles,
  requirePermissions,
  SessionCache,
} from "../../src/middleware/auth.js";
import { TokenService, createHmacKey } from "../../src/services/jwtService.js";
import type { DbClient, SessionRow, UserRow } from "../../src/db/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTokenService(): TokenService {
  const key = createHmacKey("test-secret-that-is-long-enough-for-hs256");
  return new TokenService({ signingKey: key, issuer: "iss", audience: "aud", expiresInSeconds: 900 });
}

const ACTIVE_USER: UserRow = {
  id: "user_1",
  email: "user@example.com",
  emailVerifiedAt: new Date(),
  displayName: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ACTIVE_SESSION: SessionRow & { familyId: string; absoluteExpiresAt: Date } = {
  id: "session_1",
  userId: "user_1",
  refreshTokenHash: "hash",
  userAgent: null,
  ipAddress: null,
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 86400_000),
  revokedAt: null,
  rotatedFromSessionId: null,
  familyId: "fam_1",
  absoluteExpiresAt: new Date(Date.now() + 30 * 86400_000),
};

function makeDb(
  sessionOverride?: Partial<typeof ACTIVE_SESSION> | null,
  userOverride?: Partial<UserRow> | null,
): DbClient {
  const session = sessionOverride === null ? null : { ...ACTIVE_SESSION, ...sessionOverride };
  const user = userOverride === null ? null : { ...ACTIVE_USER, ...userOverride };

  return {
    user: {
      async create() { return null as never; },
      async findUnique() { return user as never; },
      async update() { return null as never; },
    },
    session: {
      async create() { return null as never; },
      async findUnique() { return session as never; },
      async update() { return null as never; },
      async updateAtomic() { return null; },
      async revokeFamily() { return 0; },
      async deleteExpired() { return 0; },
      async findMany() { return []; },
    },
    credential: {
      async create() { return null as never; },
      async findFirst() { return null; },
      async update() { return null as never; },
    },
  };
}

function buildApp(
  tokenSvc: TokenService,
  db: DbClient = makeDb(),
  cache: SessionCache = new SessionCache(1000),
) {
  const app = express();
  app.use(express.json());

  const auth = createAuthMiddleware({ tokenService: tokenSvc, db, cache });
  const optAuth = createOptionalAuthMiddleware({ tokenService: tokenSvc, db, cache });

  app.get("/protected", auth, (req, res) => {
    res.json({ userId: req.principal?.userId });
  });
  app.get("/optional", optAuth, (req, res) => {
    res.json({ userId: req.principal?.userId ?? null });
  });
  app.get("/admin", auth, requireRoles("admin"), (req, res) => {
    res.json({ ok: true });
  });
  app.get("/perm", auth, requirePermissions("read:bookings"), (req, res) => {
    res.json({ ok: true });
  });

  return app;
}

// ─── parseBearerToken tests ────────────────────────────────────────────────────

describe("parseBearerToken", () => {
  it("returns token for valid Bearer header", () => {
    expect(parseBearerToken("Bearer mytoken123")).toBe("mytoken123");
  });

  it("is case-insensitive for scheme", () => {
    expect(parseBearerToken("bearer mytoken")).toBe("mytoken");
    expect(parseBearerToken("BEARER mytoken")).toBe("mytoken");
  });

  it("returns null for missing header", () => {
    expect(parseBearerToken(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseBearerToken("")).toBeNull();
  });

  it("returns null for scheme only", () => {
    expect(parseBearerToken("Bearer ")).toBeNull();
  });

  it("returns null for wrong scheme", () => {
    expect(parseBearerToken("Basic abc")).toBeNull();
  });

  it("returns null for extra whitespace parts", () => {
    expect(parseBearerToken("Bearer tok en")).toBeNull();
  });
});

// ─── authenticate middleware ──────────────────────────────────────────────────

describe("createAuthMiddleware", () => {
  const tokenSvc = makeTokenService();

  it("returns 401 when no Authorization header", async () => {
    const app = buildApp(tokenSvc);
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("Bearer");
    expect(res.body.error.code).toBe("unauthenticated");
  });

  it("attaches principal for valid token", async () => {
    const app = buildApp(tokenSvc);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user"] });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("user_1");
  });

  it("returns 401 for expired token", async () => {
    const expiredSvc = new TokenService({
      signingKey: createHmacKey("test-secret-that-is-long-enough-for-hs256"),
      issuer: "iss",
      audience: "aud",
      expiresInSeconds: -1,
      clockSkewSeconds: 0,
    });
    const app = buildApp(expiredSvc);
    const { token } = expiredSvc.mint({ userId: "user_1", sessionId: "session_1", roles: [] });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("invalid_token");
  });

  it("returns 401 for revoked session", async () => {
    const db = makeDb({ revokedAt: new Date() });
    const app = buildApp(tokenSvc, db);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user"] });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("session_revoked");
  });

  it("returns 403 for suspended user", async () => {
    const db = makeDb({}, { status: "suspended" });
    const app = buildApp(tokenSvc, db);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user"] });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("account_disabled");
  });

  it("serves from cache on second request (no additional DB call)", async () => {
    const db = makeDb();
    const findSpy = vi.spyOn(db.session, "findUnique");
    const cache = new SessionCache(60_000);
    const app = buildApp(tokenSvc, db, cache);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user"] });

    await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    const callsAfterFirst = findSpy.mock.calls.length;

    await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    // Second request should not call findUnique again
    expect(findSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("hits DB after cache TTL expires", async () => {
    const db = makeDb();
    const findSpy = vi.spyOn(db.session, "findUnique");
    const cache = new SessionCache(1); // 1ms TTL
    const app = buildApp(tokenSvc, db, cache);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user"] });

    await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    const callsAfterFirst = findSpy.mock.calls.length;

    // Force TTL expiry
    await new Promise((r) => setTimeout(r, 5));

    await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(findSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});

// ─── optionalAuth middleware ──────────────────────────────────────────────────

describe("createOptionalAuthMiddleware", () => {
  const tokenSvc = makeTokenService();

  it("continues anonymously when no Authorization header", async () => {
    const app = buildApp(tokenSvc);
    const res = await request(app).get("/optional");
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeNull();
  });

  it("attaches principal when valid token present", async () => {
    const app = buildApp(tokenSvc);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user"] });

    const res = await request(app)
      .get("/optional")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("user_1");
  });

  it("returns 401 for malformed token (does NOT fall through anonymously)", async () => {
    const app = buildApp(tokenSvc);
    const res = await request(app)
      .get("/optional")
      .set("Authorization", "Bearer invalid.tampered.token");

    expect(res.status).toBe(401);
  });
});

// ─── requireRoles / requirePermissions ───────────────────────────────────────

describe("requireRoles", () => {
  const tokenSvc = makeTokenService();

  it("returns 403 when role missing", async () => {
    const app = buildApp(tokenSvc);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user"] });

    const res = await request(app)
      .get("/admin")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("insufficient_permissions");
    expect(res.body.error.required).toContain("admin");
  });

  it("passes through when role present in JWT", async () => {
    const app = buildApp(tokenSvc);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user", "admin"] });

    const res = await request(app)
      .get("/admin")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe("requirePermissions", () => {
  it("throws on empty permission list (config error)", () => {
    expect(() => requirePermissions()).toThrow("configuration error");
  });

  it("returns 403 when permission missing", async () => {
    const tokenSvc = makeTokenService();
    const app = buildApp(tokenSvc);
    const { token } = tokenSvc.mint({ userId: "user_1", sessionId: "session_1", roles: ["user"] });

    const res = await request(app)
      .get("/perm")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ─── SessionCache ─────────────────────────────────────────────────────────────

describe("SessionCache", () => {
  it("returns null for missing entry", () => {
    const cache = new SessionCache();
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("returns cached entry within TTL", () => {
    const cache = new SessionCache(5000);
    const data = { userId: "u1", userStatus: "active", roles: [], permissions: [], expiresAt: new Date(), revokedAt: null };
    cache.set("s1", data);
    expect(cache.get("s1")).toBe(data);
  });

  it("invalidate removes entry immediately", () => {
    const cache = new SessionCache(5000);
    const data = { userId: "u1", userStatus: "active", roles: [], permissions: [], expiresAt: new Date(), revokedAt: null };
    cache.set("s1", data);
    cache.invalidate("s1");
    expect(cache.get("s1")).toBeNull();
  });

  it("returns null after TTL expires", () => {
    const cache = new SessionCache(100);
    const data = { userId: "u1", userStatus: "active", roles: [], permissions: [], expiresAt: new Date(), revokedAt: null };
    cache.set("s1", data);
    cache._expireForTest("s1");
    expect(cache.get("s1")).toBeNull();
  });
});
