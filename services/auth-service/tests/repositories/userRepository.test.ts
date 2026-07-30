import { describe, it, expect, beforeEach } from "vitest";
import { createUserRepository, UserConflictError, UserNotFoundError } from "../../src/repositories/userRepository.js";
import type { DbClient } from "../../src/db/types.js";
import { buildUser } from "../fixtures/userFactories.js";

// ─── Minimal in-memory mock ────────────────────────────────────────────────────

function makeDbMock(): DbClient {
  const store = new Map<string, Record<string, unknown>>();
  let idSeq = 0;

  return {
    user: {
      async create({ data }) {
        const existing = [...store.values()].find(
          (u) => (u["email"] as string).toLowerCase() === ((data["email"] ?? "") as string).toLowerCase(),
        );
        if (existing) {
          const err = Object.assign(new Error("Unique constraint"), { code: "P2002" });
          throw err;
        }
        const id = `user_${++idSeq}`;
        const now = new Date();
        const row = {
          id,
          email: ((data["email"] ?? "") as string).toLowerCase(),
          emailVerifiedAt: null,
          displayName: data["displayName"] ?? null,
          status: data["status"] ?? "pending",
          createdAt: now,
          updatedAt: now,
        };
        store.set(id, row);
        return row as never;
      },
      async findUnique({ where }) {
        if (where["id"]) return (store.get(where["id"] as string) ?? null) as never;
        if (where["email"]) {
          return ([...store.values()].find(
            (u) => (u["email"] as string) === (where["email"] as string).toLowerCase(),
          ) ?? null) as never;
        }
        return null;
      },
      async update({ where, data }) {
        const row = store.get(where.id);
        if (!row) throw Object.assign(new Error("Not found"), { code: "P2025" });
        Object.assign(row, data, { updatedAt: new Date() });
        return row as never;
      },
    },
    session: {
      async create() { return null as never; },
      async findUnique() { return null; },
      async update() { return null as never; },
      async updateAtomic() { return null; },
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

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("userRepository.create", () => {
  let repo: ReturnType<typeof createUserRepository>;

  beforeEach(() => {
    repo = createUserRepository(makeDbMock());
  });

  it("creates a user with normalized email", async () => {
    const user = await repo.create({ email: "Test@Example.Com", displayName: "Test" });
    expect(user.email).toBe("test@example.com");
    expect(user.status).toBe("pending");
    expect(user.id).toBeDefined();
  });

  it("throws UserConflictError on duplicate email (case-insensitive)", async () => {
    await repo.create(buildUser({ email: "dup@voya.test" }));
    await expect(repo.create(buildUser({ email: "DUP@voya.test" }))).rejects.toThrow(
      UserConflictError,
    );
  });

  it("strips leading/trailing whitespace from email", async () => {
    const user = await repo.create({ email: "  padded@voya.test  " });
    expect(user.email).toBe("padded@voya.test");
  });
});

describe("userRepository.findById", () => {
  let repo: ReturnType<typeof createUserRepository>;

  beforeEach(() => {
    repo = createUserRepository(makeDbMock());
  });

  it("returns null when user does not exist", async () => {
    const result = await repo.findById("nonexistent");
    expect(result).toBeNull();
  });

  it("returns the user when found", async () => {
    const created = await repo.create(buildUser());
    const found = await repo.findById(created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.email).toBe(created.email);
  });
});

describe("userRepository.findByEmail", () => {
  let repo: ReturnType<typeof createUserRepository>;

  beforeEach(() => {
    repo = createUserRepository(makeDbMock());
  });

  it("returns null for unknown email", async () => {
    expect(await repo.findByEmail("nobody@voya.test")).toBeNull();
  });

  it("finds by email case-insensitively", async () => {
    await repo.create(buildUser({ email: "case@voya.test" }));
    const found = await repo.findByEmail("CASE@voya.test");
    expect(found?.email).toBe("case@voya.test");
  });
});

describe("userRepository.updateStatus", () => {
  let repo: ReturnType<typeof createUserRepository>;

  beforeEach(() => {
    repo = createUserRepository(makeDbMock());
  });

  it("updates the user status", async () => {
    const user = await repo.create(buildUser());
    const updated = await repo.updateStatus(user.id, "active");
    expect(updated.status).toBe("active");
  });

  it("throws UserNotFoundError for unknown user ID", async () => {
    await expect(repo.updateStatus("nonexistent-id", "active")).rejects.toThrow(
      UserNotFoundError,
    );
  });
});
