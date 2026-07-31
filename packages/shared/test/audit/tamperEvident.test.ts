import { describe, it, expect } from "vitest";
import {
  computeChainHash,
  verifyChain,
  TamperEvidentAuditWriter,
  type AuditLogEntry,
  type AuditLogStore,
} from "../../src/tamperEvidentAudit.ts";

class InMemoryAuditStore implements AuditLogStore {
  private entries: AuditLogEntry[] = [];

  async append(entry: Omit<AuditLogEntry, "id" | "sequence">): Promise<AuditLogEntry> {
    const record: AuditLogEntry = {
      ...entry,
      id: `audit_${this.entries.length + 1}`,
      sequence: this.entries.length + 1,
    };
    this.entries.push(record);
    return record;
  }

  async getLastEntry() { return this.entries[this.entries.length - 1] ?? null; }
  async getEntriesForResource(resourceType: string, resourceId: string) {
    return this.entries.filter((e) => e.resourceType === resourceType && e.resourceId === resourceId);
  }
  async getAllEntries(from?: number, limit?: number) {
    let result = from ? this.entries.filter((e) => e.sequence >= from) : [...this.entries];
    if (limit) result = result.slice(0, limit);
    return result;
  }
}

function makeEntry(override: Partial<AuditLogEntry> = {}): Omit<AuditLogEntry, "id" | "sequence" | "chainHash"> {
  return {
    actorId: "u1",
    actorRole: "traveler",
    action: "booking.created",
    resourceType: "booking",
    resourceId: "b1",
    payload: { status: "PENDING" },
    occurredAt: new Date("2026-01-01T00:00:00Z"),
    ...override,
  };
}

describe("TamperEvidentAuditWriter", () => {
  it("writes an entry with a chain hash", async () => {
    const writer = new TamperEvidentAuditWriter(new InMemoryAuditStore());
    const entry = await writer.write(makeEntry());
    expect(entry.chainHash).toBeDefined();
    expect(entry.chainHash).toHaveLength(64); // SHA-256 hex
  });

  it("subsequent entries form a valid chain", async () => {
    const store = new InMemoryAuditStore();
    const writer = new TamperEvidentAuditWriter(store);
    await writer.write(makeEntry({ action: "booking.created" }));
    await writer.write(makeEntry({ action: "booking.confirmed" }));
    await writer.write(makeEntry({ action: "booking.completed" }));

    const result = await writer.verifyIntegrity();
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.entries).toBe(3);
  });

  it("detects tampering when a chain hash is modified", async () => {
    const store = new InMemoryAuditStore();
    const writer = new TamperEvidentAuditWriter(store);
    await writer.write(makeEntry({ action: "booking.created" }));
    await writer.write(makeEntry({ action: "booking.confirmed" }));

    // Tamper with the first entry
    const entries = await store.getAllEntries();
    (entries[0] as AuditLogEntry).chainHash = "0".repeat(64);

    const result = verifyChain(entries);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.firstInvalidAtSequence).toBeGreaterThan(0);
    }
  });

  it("genesis entry uses 'genesis' as previous hash", async () => {
    const store = new InMemoryAuditStore();
    const writer = new TamperEvidentAuditWriter(store);
    const entry = await writer.write(makeEntry());

    const expected = computeChainHash(
      "genesis",
      entry.actorId,
      entry.resourceType,
      entry.resourceId,
      entry.occurredAt,
      entry.action,
    );
    expect(entry.chainHash).toBe(expected);
  });
});
