import { describe, it, expect, beforeEach } from "vitest";
import {
  createSessionRepository,
  SessionNotFoundError,
} from "../../src/repositories/sessionRepository.js";
import type { DbClient } from "../../src/db/types.js";
import { buildSession, buildExpiredSession } from "../fixtures/userFactories.js";

// ─── Minimal in-memory mock ────────────────────────────────────────────────────

function makeDbMock(): DbClient {
  const store = new Map<string, Record<string, unknown>>();
  let idSeq = 0;

  return {
    user: {
      async create() { return null as never; },
      async findUnique() { return null; },
      async update() { return null as never; },
    },
    session: {
      async create({ data }) {
        const id = `session_${++idSeq}`;
        const now = new Date();
        const row = {
          id,
          userId: data["userId"],
          refreshTokenHash: data["refreshTokenHash"],
          userAgent: data["userAgent"] ?? null,
          ipAddress: data["ipAddress"] ?? null,
          issuedAt: now,
          expiresAt: data["expiresAt"],
          revokedAt: null,
          rotatedFromSessionId: data["rotatedFromSessionId"] ?? null,
        };
        store.set(id, row);
        return row as never;
      },
      async findUnique({ where }) {
        if (where["id"]) return (store.get(where["id"] as string) ?? null) as never;
        if (where["refreshTokenHash"]) {
          return ([...store.values()].find(
            (s) => s["refreshTokenHash"] === where["refreshTokenHash"],
          ) ?? null) as never;
        }
        return null;
      },
      async update({ where, data }) {
        const row = store.get(where.id);
        if (!row) throw Object.assign(new Error("Not found"), { code: "P2025" });
        Object.assign(row, data);
        return row as never;
      },
    },
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("sessionRepository.create", () => {
  let repo: ReturnType<typeof createSessionRepository>;

  beforeEach(() => {
    repo = createSessionRepository(makeDbMock());
  });

  it("creates a session with required fields", async () => {
    const input = buildSession("user_001");
    const session = await repo.create(input);
    expect(session.id).toBeDefined();
    expect(session.userId).toBe("user_001");
    expect(session.refreshTokenHash).toBe(input.refreshTokenHash);
    expect(session.revokedAt).toBeNull();
    expect(session.rotatedFromSessionId).toBeNull();
  });

  it("stores the rotatedFromSessionId when provided", async () => {
    const first = await repo.create(buildSession("user_002"));
    const rotated = await repo.create(
      buildSession("user_002", { rotatedFromSessionId: first.id }),
    );
    expect(rotated.rotatedFromSessionId).toBe(first.id);
  });
});

describe("sessionRepository.findActiveByRefreshHash", () => {
  let repo: ReturnType<typeof createSessionRepository>;

  beforeEach(() => {
    repo = createSessionRepository(makeDbMock());
  });

  it("returns null for unknown hash", async () => {
    expect(await repo.findActiveByRefreshHash("nonexistent")).toBeNull();
  });

  it("returns the session when active and not expired", async () => {
    const input = buildSession("user_003");
    const created = await repo.create(input);
    const found = await repo.findActiveByRefreshHash(input.refreshTokenHash);
    expect(found?.id).toBe(created.id);
  });

  it("returns null for expired sessions", async () => {
    const input = buildExpiredSession("user_004");
    await repo.create(input);
    const found = await repo.findActiveByRefreshHash(input.refreshTokenHash);
    expect(found).toBeNull();
  });

  it("returns null for revoked sessions", async () => {
    const input = buildSession("user_005");
    const created = await repo.create(input);
    await repo.revoke(created.id);
    const found = await repo.findActiveByRefreshHash(input.refreshTokenHash);
    expect(found).toBeNull();
  });
});

describe("sessionRepository.revoke", () => {
  let repo: ReturnType<typeof createSessionRepository>;

  beforeEach(() => {
    repo = createSessionRepository(makeDbMock());
  });

  it("revokes a session by setting revokedAt", async () => {
    const session = await repo.create(buildSession("user_006"));
    await expect(repo.revoke(session.id)).resolves.toBeUndefined();
  });

  it("throws SessionNotFoundError for unknown session ID", async () => {
    await expect(repo.revoke("nonexistent")).rejects.toThrow(SessionNotFoundError);
  });
});
