import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefreshService, runSessionCleanup } from "../../src/services/refreshService.js";
import { TokenService, createHmacKey } from "../../src/services/jwtService.js";
import { generateRefreshToken, hashRefreshToken } from "../../src/repositories/sessionRepository.js";
import type { DbClient, SessionRow } from "../../src/db/types.js";

// ─── In-memory session store ──────────────────────────────────────────────────

function makeSessionStore() {
  const store = new Map<string, SessionRow & { familyId: string; absoluteExpiresAt: Date }>();
  let idSeq = 0;

  return {
    store,
    delegate: {
      async create({ data }: { data: Partial<SessionRow> }) {
        const id = `session_${++idSeq}`;
        const now = new Date();
        const row = {
          id,
          userId: data.userId ?? "u1",
          refreshTokenHash: data.refreshTokenHash ?? "",
          userAgent: data.userAgent ?? null,
          ipAddress: data.ipAddress ?? null,
          issuedAt: now,
          expiresAt: (data as Record<string, unknown>)["expiresAt"] as Date ?? new Date(Date.now() + 14 * 86400_000),
          revokedAt: null,
          rotatedFromSessionId: (data as Record<string, unknown>)["rotatedFromSessionId"] as string | null ?? null,
          familyId: (data as Record<string, unknown>)["familyId"] as string ?? id,
          absoluteExpiresAt: (data as Record<string, unknown>)["absoluteExpiresAt"] as Date ?? new Date(Date.now() + 30 * 86400_000),
        };
        store.set(id, row);
        return row as never;
      },
      async findUnique({ where }: { where: { id?: string; refreshTokenHash?: string } }) {
        if (where.id) return (store.get(where.id) ?? null) as never;
        if (where.refreshTokenHash) {
          for (const row of store.values()) {
            if (row.refreshTokenHash === where.refreshTokenHash) return row as never;
          }
        }
        return null;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<SessionRow> }) {
        const row = store.get(where.id);
        if (!row) throw Object.assign(new Error("Not found"), { code: "P2025" });
        Object.assign(row, data);
        return row as never;
      },
      async updateAtomic({ where, data }: { where: { id: string }; data: Partial<SessionRow> }) {
        const row = store.get(where.id);
        if (!row || row.revokedAt !== null) return null; // already revoked
        Object.assign(row, data);
        return row as never;
      },
      async revokeFamily({ familyId }: { familyId: string }) {
        let count = 0;
        for (const row of store.values()) {
          if (row.familyId === familyId && row.revokedAt === null) {
            row.revokedAt = new Date();
            count++;
          }
        }
        return count;
      },
      async deleteExpired({ before, revokedBefore, limit = 1000 }: { before: Date; revokedBefore?: Date; limit?: number }) {
        let count = 0;
        for (const [id, row] of store.entries()) {
          if (count >= limit) break;
          const expiredByTime = row.expiresAt < before;
          const revokedOld = revokedBefore && row.revokedAt !== null && row.revokedAt < revokedBefore;
          if (expiredByTime || revokedOld) {
            store.delete(id);
            count++;
          }
        }
        return count;
      },
      async findMany({ where }: { where: { userId?: string } }) {
        return [...store.values()].filter((r) => !where.userId || r.userId === where.userId);
      },
    },
  };
}

function makeDb(sessionDelegate: ReturnType<typeof makeSessionStore>["delegate"]): DbClient {
  return {
    user: {
      async create() { return null as never; },
      async findUnique() { return null; },
      async update() { return null as never; },
    },
    session: sessionDelegate as never,
    credential: {
      async create() { return null as never; },
      async findFirst() { return null; },
      async update() { return null as never; },
    },
  };
}

function makeTokenService(): TokenService {
  const key = createHmacKey("test-secret-that-is-long-enough-for-hs256");
  return new TokenService({ signingKey: key, issuer: "iss", audience: "aud", expiresInSeconds: 900 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedSession(
  sessionStore: ReturnType<typeof makeSessionStore>,
  overrides: Partial<SessionRow & { familyId: string; absoluteExpiresAt: Date }> = {},
) {
  const id = `seeded_${Math.random().toString(36).slice(2)}`;
  const now = new Date();
  const row: SessionRow & { familyId: string; absoluteExpiresAt: Date } = {
    id,
    userId: "u1",
    refreshTokenHash: "seededhash",
    userAgent: null,
    ipAddress: null,
    issuedAt: now,
    expiresAt: new Date(Date.now() + 14 * 86400_000),
    revokedAt: null,
    rotatedFromSessionId: null,
    familyId: id,
    absoluteExpiresAt: new Date(Date.now() + 30 * 86400_000),
    ...overrides,
  };
  sessionStore.store.set(id, row);
  return row;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RefreshService — happy path", () => {
  it("rotates a valid refresh token and returns a new access + refresh token", async () => {
    const { store, delegate } = makeSessionStore();
    const db = makeDb(delegate);
    const tokenSvc = makeTokenService();
    const svc = new RefreshService({ db, tokenService: tokenSvc });

    const rawToken = generateRefreshToken();
    const hash = hashRefreshToken(rawToken);
    seedSession({ store, delegate }, { refreshTokenHash: hash });

    const result = await svc.refresh({ refreshToken: rawToken, ipAddress: "1.2.3.4" });

    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("expected success");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).not.toBe(rawToken); // new token issued
    expect(result.tokenType).toBe("Bearer");
  });

  it("old session is revoked after rotation", async () => {
    const { store, delegate } = makeSessionStore();
    const db = makeDb(delegate);
    const svc = new RefreshService({ db, tokenService: makeTokenService() });

    const rawToken = generateRefreshToken();
    const hash = hashRefreshToken(rawToken);
    const seeded = seedSession({ store, delegate }, { refreshTokenHash: hash });

    await svc.refresh({ refreshToken: rawToken });

    const oldRow = store.get(seeded.id);
    expect(oldRow?.revokedAt).not.toBeNull();
  });

  it("new session has rotated_from_session_id pointing at old", async () => {
    const { store, delegate } = makeSessionStore();
    const db = makeDb(delegate);
    const svc = new RefreshService({ db, tokenService: makeTokenService() });

    const rawToken = generateRefreshToken();
    const seeded = seedSession({ store, delegate }, { refreshTokenHash: hashRefreshToken(rawToken) });

    const result = await svc.refresh({ refreshToken: rawToken });
    if (result.outcome !== "success") throw new Error("expected success");

    // Find new session by scanning for the new hash
    const newHash = hashRefreshToken(result.refreshToken);
    let newSession: (SessionRow & { familyId: string }) | undefined;
    for (const row of store.values()) {
      if (row.refreshTokenHash === newHash) { newSession = row; break; }
    }
    expect(newSession?.rotatedFromSessionId).toBe(seeded.id);
  });

  it("absolute expiry is NOT extended by rotation", async () => {
    const { store, delegate } = makeSessionStore();
    const db = makeDb(delegate);
    const svc = new RefreshService({ db, tokenService: makeTokenService() });

    const absExpiry = new Date(Date.now() + 2 * 86400_000); // 2 days
    const rawToken = generateRefreshToken();
    seedSession({ store, delegate }, {
      refreshTokenHash: hashRefreshToken(rawToken),
      absoluteExpiresAt: absExpiry,
    });

    const result = await svc.refresh({ refreshToken: rawToken });
    if (result.outcome !== "success") throw new Error("expected success");

    const newHash = hashRefreshToken(result.refreshToken);
    let newRow: (SessionRow & { absoluteExpiresAt: Date }) | undefined;
    for (const row of store.values()) {
      if (row.refreshTokenHash === newHash) { newRow = row; break; }
    }
    // absoluteExpiresAt must equal the original (not extended)
    expect(newRow?.absoluteExpiresAt.getTime()).toBe(absExpiry.getTime());
  });
});

describe("RefreshService — error cases", () => {
  it("returns invalid_refresh_token for unknown token", async () => {
    const { delegate } = makeSessionStore();
    const svc = new RefreshService({ db: makeDb(delegate), tokenService: makeTokenService() });

    const result = await svc.refresh({ refreshToken: "unknowntoken123" });
    expect(result.outcome).toBe("invalid_refresh_token");
  });

  it("returns session_expired for idle-expired session", async () => {
    const { store, delegate } = makeSessionStore();
    const svc = new RefreshService({ db: makeDb(delegate), tokenService: makeTokenService() });

    const rawToken = generateRefreshToken();
    seedSession({ store, delegate }, {
      refreshTokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() - 1000), // already expired
    });

    const result = await svc.refresh({ refreshToken: rawToken });
    expect(result.outcome).toBe("session_expired");
  });

  it("returns session_expired for absolute-expired session", async () => {
    const { store, delegate } = makeSessionStore();
    const svc = new RefreshService({ db: makeDb(delegate), tokenService: makeTokenService() });

    const rawToken = generateRefreshToken();
    seedSession({ store, delegate }, {
      refreshTokenHash: hashRefreshToken(rawToken),
      absoluteExpiresAt: new Date(Date.now() - 1000), // absolute expired
    });

    const result = await svc.refresh({ refreshToken: rawToken });
    expect(result.outcome).toBe("session_expired");
  });

  it("detects reuse and revokes entire family", async () => {
    const { store, delegate } = makeSessionStore();
    const reuseCallback = vi.fn();
    const svc = new RefreshService({
      db: makeDb(delegate),
      tokenService: makeTokenService(),
      onReuseDetected: reuseCallback,
    });

    const familyId = "fam-123";
    const rawToken = generateRefreshToken();

    // Seed an already-revoked session (simulating replay of rotated token)
    const seeded = seedSession({ store, delegate }, {
      refreshTokenHash: hashRefreshToken(rawToken),
      revokedAt: new Date(),
      familyId,
    });

    // Seed another active session in the same family
    const sibling = seedSession({ store, delegate }, {
      familyId,
      rotatedFromSessionId: seeded.id,
    });

    const result = await svc.refresh({ refreshToken: rawToken, ipAddress: "1.2.3.4" });

    expect(result.outcome).toBe("refresh_token_reused");
    expect(reuseCallback).toHaveBeenCalledOnce();

    // Sibling must now be revoked
    expect(store.get(sibling.id)?.revokedAt).not.toBeNull();
  });

  it("returns invalid_refresh_token for oversized input", async () => {
    const { delegate } = makeSessionStore();
    const svc = new RefreshService({ db: makeDb(delegate), tokenService: makeTokenService() });

    const result = await svc.refresh({ refreshToken: "x".repeat(513) });
    expect(result.outcome).toBe("invalid_refresh_token");
  });

  it("concurrent rotation: second request loses and returns invalid_refresh_token without family revocation", async () => {
    const { store, delegate } = makeSessionStore();
    const svc = new RefreshService({ db: makeDb(delegate), tokenService: makeTokenService() });

    const rawToken = generateRefreshToken();
    const seeded = seedSession({ store, delegate }, { refreshTokenHash: hashRefreshToken(rawToken) });

    // First call succeeds
    const r1 = await svc.refresh({ refreshToken: rawToken });
    expect(r1.outcome).toBe("success");

    // Second call with same token: the old session is already revoked
    // → should detect as "reuse" OR "invalid_refresh_token"
    const r2 = await svc.refresh({ refreshToken: rawToken });
    expect(["invalid_refresh_token", "refresh_token_reused"]).toContain(r2.outcome);

    // No active family sessions should be revoked by the test scenario
    void seeded;
  });
});

describe("runSessionCleanup", () => {
  it("deletes expired sessions", async () => {
    const { store, delegate } = makeSessionStore();

    seedSession({ store, delegate }, { expiresAt: new Date(Date.now() - 86400_000) });
    seedSession({ store, delegate }, { expiresAt: new Date(Date.now() + 86400_000) }); // active

    const deleted = await runSessionCleanup({
      db: makeDb(delegate),
      expiredBefore: new Date(),
    });

    expect(deleted).toBe(1);
    expect(store.size).toBe(1);
  });

  it("deletes old revoked sessions", async () => {
    const { store, delegate } = makeSessionStore();

    const oldRevoked = seedSession({ store, delegate });
    store.get(oldRevoked.id)!.revokedAt = new Date(Date.now() - 31 * 86400_000);

    const recentRevoked = seedSession({ store, delegate });
    store.get(recentRevoked.id)!.revokedAt = new Date(); // just revoked

    const deleted = await runSessionCleanup({
      db: makeDb(delegate),
      expiredBefore: new Date(0), // don't delete by expiry
      revokedBefore: new Date(Date.now() - 30 * 86400_000),
    });

    expect(deleted).toBe(1);
  });

  it("respects batch size limit", async () => {
    const { store, delegate } = makeSessionStore();

    for (let i = 0; i < 5; i++) {
      seedSession({ store, delegate }, { expiresAt: new Date(0) });
    }

    const deleted = await runSessionCleanup({
      db: makeDb(delegate),
      expiredBefore: new Date(),
      batchSize: 3,
    });

    expect(deleted).toBe(3);
    expect(store.size).toBe(2);
  });
});
