import { describe, it, expect } from "vitest";
import {
  RetentionPurgeJob,
  type RetentionDataPort,
  type PurgeAuditPort,
} from "../../src/domain/RetentionPurgeJob.js";

function makeDataPort(overrides: Partial<{
  softDeletedUsers: { userId: string }[];
  expiredDocs: { id: string; userId: string }[];
  oldBookings: { bookingId: string }[];
}>): RetentionDataPort {
  return {
    async getSoftDeletedUsersBefore() { return overrides.softDeletedUsers ?? []; },
    async getExpiredIdentityDocs() { return overrides.expiredDocs ?? []; },
    async getBookingsOlderThan() { return overrides.oldBookings ?? []; },
    async eraseUser() {},
    async deleteIdentityDoc() {},
    async anonymizeBooking() {},
  };
}

class InMemoryAuditPort implements PurgeAuditPort {
  readonly entries: { action: string; targetId: string }[] = [];
  async record(entry: { action: string; targetType: string; targetId: string; reason: string }) {
    this.entries.push(entry);
  }
}

describe("RetentionPurgeJob", () => {
  it("returns clean report when nothing to purge", async () => {
    const job = new RetentionPurgeJob(makeDataPort({}), new InMemoryAuditPort());
    const report = await job.run();
    expect(report.usersErased).toBe(0);
    expect(report.identityDocsPurged).toBe(0);
    expect(report.bookingsAnonymized).toBe(0);
    expect(report.errors).toHaveLength(0);
  });

  it("erases soft-deleted users and writes audit entries", async () => {
    const audit = new InMemoryAuditPort();
    const job = new RetentionPurgeJob(
      makeDataPort({ softDeletedUsers: [{ userId: "u1" }, { userId: "u2" }] }),
      audit,
    );
    const report = await job.run();
    expect(report.usersErased).toBe(2);
    expect(audit.entries.filter((e) => e.action === "user_erased")).toHaveLength(2);
  });

  it("purges expired identity documents", async () => {
    const audit = new InMemoryAuditPort();
    const job = new RetentionPurgeJob(
      makeDataPort({ expiredDocs: [{ id: "doc_1", userId: "u1" }] }),
      audit,
    );
    const report = await job.run();
    expect(report.identityDocsPurged).toBe(1);
    expect(audit.entries.some((e) => e.action === "identity_doc_purged")).toBe(true);
  });

  it("anonymizes old bookings", async () => {
    const job = new RetentionPurgeJob(
      makeDataPort({ oldBookings: [{ bookingId: "b1" }, { bookingId: "b2" }] }),
      new InMemoryAuditPort(),
    );
    const report = await job.run();
    expect(report.bookingsAnonymized).toBe(2);
  });

  it("records errors and continues processing remaining items", async () => {
    const dataPort: RetentionDataPort = {
      async getSoftDeletedUsersBefore() { return [{ userId: "u1" }]; },
      async getExpiredIdentityDocs() { return []; },
      async getBookingsOlderThan() { return []; },
      async eraseUser() { throw new Error("DB error"); },
      async deleteIdentityDoc() {},
      async anonymizeBooking() {},
    };
    const job = new RetentionPurgeJob(dataPort, new InMemoryAuditPort());
    const report = await job.run();
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("u1");
    expect(report.usersErased).toBe(0);
  });
});
