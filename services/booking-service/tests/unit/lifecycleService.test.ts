import { describe, it, expect, beforeEach } from "vitest";
import {
  BookingLifecycleService,
  LifecycleConflictError,
  BookingNotFoundError,
  type BookingRepositoryPort,
  type BookingRecord,
} from "../../src/domain/BookingLifecycleService.js";
import { InMemoryAuditStore, AuditWriter } from "../../src/domain/AuditWriter.js";
import type { BookingStatus } from "../../src/domain/transitions.js";

// ─── In-memory repository ─────────────────────────────────────────────────────

class InMemoryBookingRepo implements BookingRepositoryPort {
  private readonly store = new Map<string, BookingRecord>();

  seed(booking: BookingRecord) {
    this.store.set(booking.id, { ...booking });
  }

  async findById(id: string): Promise<BookingRecord | null> {
    return this.store.get(id) ?? null;
  }

  async conditionalStatusUpdate(
    id: string,
    expectedFrom: BookingStatus,
    to: BookingStatus,
  ): Promise<BookingRecord | null> {
    const existing = this.store.get(id);
    if (!existing || existing.status !== expectedFrom) return null;
    const updated = { ...existing, status: to };
    this.store.set(id, updated);
    return updated;
  }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

const ACTOR = { id: "user_abc", role: "traveler" };

function makeService() {
  const repo = new InMemoryBookingRepo();
  const auditStore = new InMemoryAuditStore();
  const auditWriter = new AuditWriter(auditStore);
  const svc = new BookingLifecycleService(repo, auditWriter);
  return { repo, auditStore, svc };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BookingLifecycleService — allowed transitions", () => {
  it("PENDING → CONFIRMED succeeds and writes audit row", async () => {
    const { repo, auditStore, svc } = makeService();
    repo.seed({ id: "b1", status: "PENDING" });

    const result = await svc.transition("b1", "CONFIRMED", ACTOR, "payment received");
    expect(result.booking.status).toBe("CONFIRMED");
    expect(result.isNoOp).toBe(false);
    expect(auditStore.rows).toHaveLength(1);
    expect(auditStore.rows[0]!.actorId).toBe("user_abc");
  });

  it("PENDING → CANCELLED succeeds", async () => {
    const { repo, svc } = makeService();
    repo.seed({ id: "b2", status: "PENDING" });
    const result = await svc.transition("b2", "CANCELLED", ACTOR);
    expect(result.booking.status).toBe("CANCELLED");
  });

  it("CONFIRMED → COMPLETED succeeds", async () => {
    const { repo, svc } = makeService();
    repo.seed({ id: "b3", status: "CONFIRMED" });
    const result = await svc.transition("b3", "COMPLETED", ACTOR);
    expect(result.booking.status).toBe("COMPLETED");
  });
});

describe("BookingLifecycleService — disallowed transitions (409)", () => {
  it("PENDING → COMPLETED throws LifecycleConflictError with allowed targets", async () => {
    const { repo, svc } = makeService();
    repo.seed({ id: "b4", status: "PENDING" });

    await expect(svc.transition("b4", "COMPLETED", ACTOR)).rejects.toThrow(
      LifecycleConflictError,
    );
    try {
      await svc.transition("b4", "COMPLETED", ACTOR);
    } catch (e) {
      const err = e as LifecycleConflictError;
      expect(err.currentStatus).toBe("PENDING");
      expect(err.allowedTransitions).toContain("CONFIRMED");
      expect(err.allowedTransitions).toContain("CANCELLED");
    }
  });

  it("CANCELLED → CONFIRMED throws LifecycleConflictError with empty allowed list", async () => {
    const { repo, svc } = makeService();
    repo.seed({ id: "b5", status: "CANCELLED" });

    await expect(svc.transition("b5", "CONFIRMED", ACTOR)).rejects.toThrow(
      LifecycleConflictError,
    );
  });
});

describe("BookingLifecycleService — idempotency", () => {
  it("CONFIRMED → CONFIRMED is a no-op (no audit row)", async () => {
    const { repo, auditStore, svc } = makeService();
    repo.seed({ id: "b6", status: "CONFIRMED" });

    const result = await svc.transition("b6", "CONFIRMED", ACTOR);
    expect(result.isNoOp).toBe(true);
    expect(auditStore.rows).toHaveLength(0);
  });

  it("CANCELLED → CANCELLED is a no-op", async () => {
    const { repo, auditStore, svc } = makeService();
    repo.seed({ id: "b7", status: "CANCELLED" });

    const result = await svc.transition("b7", "CANCELLED", ACTOR);
    expect(result.isNoOp).toBe(true);
    expect(auditStore.rows).toHaveLength(0);
  });
});

describe("BookingLifecycleService — not found", () => {
  it("throws BookingNotFoundError for unknown booking ID", async () => {
    const { svc } = makeService();
    await expect(svc.transition("nonexistent", "CONFIRMED", ACTOR)).rejects.toThrow(
      BookingNotFoundError,
    );
  });
});

describe("BookingLifecycleService — concurrency", () => {
  it("concurrent transitions: only one audit row written when both race PENDING → CONFIRMED", async () => {
    const { repo, auditStore, svc } = makeService();
    repo.seed({ id: "b8", status: "PENDING" });

    const [r1, r2] = await Promise.allSettled([
      svc.transition("b8", "CONFIRMED", ACTOR),
      svc.transition("b8", "CONFIRMED", ACTOR),
    ]);

    const successes = [r1, r2].filter((r) => r.status === "fulfilled");
    const conflicts = [r1, r2].filter((r) => r.status === "rejected");

    // Exactly one succeeds and writes audit
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(auditStore.rows).toHaveLength(1);
  });
});
