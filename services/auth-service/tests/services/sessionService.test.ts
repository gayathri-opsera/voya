import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { SessionService } from "../../src/services/sessionService.js";
import type { DbClient, SessionRow, UserRow } from "../../src/db/types.js";

const NOW = new Date();
const FUTURE = new Date(NOW.getTime() + 86400_000);

function makeSession(overrides?: Partial<SessionRow>): SessionRow {
  return {
    id: "s1",
    userId: "u1",
    refreshTokenHash: "h1",
    userAgent: "TestAgent/1.0",
    ipAddress: "127.0.0.1",
    issuedAt: NOW,
    expiresAt: FUTURE,
    revokedAt: null,
    rotatedFromSessionId: null,
    familyId: "fam1",
    absoluteExpiresAt: new Date(NOW.getTime() + 30 * 86400_000),
    ...overrides,
  };
}

function makeDb(sessions: SessionRow[] = [], user?: Partial<UserRow>): DbClient {
  const store = new Map(sessions.map((s) => [s.id, { ...s }]));
  return {
    user: {
      async create() { return null as never; },
      async findUnique() {
        return { id: "u1", email: "a@b.com", emailVerifiedAt: null, displayName: null, status: "active", createdAt: NOW, updatedAt: NOW, ...user } as UserRow;
      },
      async update() { return null as never; },
    },
    session: {
      async create() { return null as never; },
      async findUnique({ where }) {
        if (where.id) return store.get(where.id) ?? null;
        return null;
      },
      async findMany({ where }) {
        return [...store.values()].filter((s) => !where.userId || s.userId === where.userId);
      },
      async update() { return null as never; },
      async updateAtomic({ where, data }) {
        const row = store.get(where.id);
        if (!row) return null;
        if (row.revokedAt !== null && data.revokedAt) return null; // already revoked
        Object.assign(row, data);
        return row;
      },
      async revokeFamily() { return 0; },
      async deleteExpired() { return 0; },
    },
    credential: {
      async create() { return null as never; },
      async findFirst() { return null; },
      async update() { return null as never; },
    },
  };
}

describe("SessionService - revokeById", () => {
  it("revokes an active session and returns true", async () => {
    const db = makeDb([makeSession({ id: "s1" })]);
    const svc = new SessionService(db);
    const result = await svc.revokeById("s1");
    expect(result).toBe(true);
  });

  it("returns false for an already-revoked session (idempotent)", async () => {
    const db = makeDb([makeSession({ id: "s1", revokedAt: new Date() })]);
    const svc = new SessionService(db);
    const result = await svc.revokeById("s1");
    expect(result).toBe(false);
  });

  it("returns false for unknown session id", async () => {
    const db = makeDb([]);
    const svc = new SessionService(db);
    const result = await svc.revokeById("nonexistent");
    expect(result).toBe(false);
  });
});

describe("SessionService - revokeAllForUser", () => {
  it("revokes all active sessions and returns count", async () => {
    const db = makeDb([
      makeSession({ id: "s1", userId: "u1" }),
      makeSession({ id: "s2", userId: "u1" }),
    ]);
    const svc = new SessionService(db);
    const count = await svc.revokeAllForUser("u1");
    expect(count).toBe(2);
  });

  it("returns 0 when no active sessions", async () => {
    const db = makeDb([makeSession({ id: "s1", revokedAt: new Date() })]);
    const svc = new SessionService(db);
    const count = await svc.revokeAllForUser("u1");
    expect(count).toBe(0);
  });
});

describe("SessionService - listActiveForUser", () => {
  it("returns safe summary without token hashes", async () => {
    const db = makeDb([makeSession({ id: "s1", userId: "u1" })]);
    const svc = new SessionService(db);
    const sessions = await svc.listActiveForUser("u1", "s1");
    expect(sessions).toHaveLength(1);
    const s = sessions[0]!;
    expect(s.id).toBe("s1");
    expect(s.current).toBe(true);
    // No refreshTokenHash property in summary
    expect((s as Record<string, unknown>).refreshTokenHash).toBeUndefined();
  });

  it("marks only current session with current: true", async () => {
    const db = makeDb([
      makeSession({ id: "s1", userId: "u1" }),
      makeSession({ id: "s2", userId: "u1" }),
    ]);
    const svc = new SessionService(db);
    const sessions = await svc.listActiveForUser("u1", "s2");
    const current = sessions.find((s) => s.current);
    expect(current?.id).toBe("s2");
    const other = sessions.find((s) => s.id === "s1");
    expect(other?.current).toBe(false);
  });
});

describe("SessionService - revokeForUser", () => {
  it("returns 'not_found' for session belonging to another user", async () => {
    const db = makeDb([makeSession({ id: "s1", userId: "u2" })]);
    const svc = new SessionService(db);
    const result = await svc.revokeForUser("s1", "u1");
    expect(result).toBe("not_found");
  });

  it("returns 'revoked' for own session", async () => {
    const db = makeDb([makeSession({ id: "s1", userId: "u1" })]);
    const svc = new SessionService(db);
    const result = await svc.revokeForUser("s1", "u1");
    expect(result).toBe("revoked");
  });
});
