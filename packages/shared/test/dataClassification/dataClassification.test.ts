import { describe, it, expect } from "vitest";
import {
  DataClassificationService,
  FIELD_CLASSIFICATIONS,
} from "../../src/dataClassification.ts";

class InMemoryClassificationStore {
  private readonly tags: import("../../src/dataClassification.ts").DataClassificationTag[] = [];
  async save(tag: import("../../src/dataClassification.ts").DataClassificationTag) { this.tags.push(tag); }
  async findByEntity(entityType: string, entityId: string) {
    return this.tags.filter((t) => t.entityType === entityType && t.entityId === entityId);
  }
  async findDueToPurge(before: Date) {
    return this.tags.filter((t) => t.purgeAfter && t.purgeAfter < before);
  }
}

describe("DataClassificationService", () => {
  it("tags all known fields for a user entity", async () => {
    const store = new InMemoryClassificationStore();
    const svc = new DataClassificationService(store as any);

    const tags = await svc.tagEntity("user", "user_123", "system");
    const fields = FIELD_CLASSIFICATIONS["user"] ?? {};
    expect(tags.length).toBe(Object.keys(fields).length);
    expect(tags.every((t) => t.entityType === "user")).toBe(true);
  });

  it("applies CONFIDENTIAL classification to email", async () => {
    const store = new InMemoryClassificationStore();
    const svc = new DataClassificationService(store as any);
    const tags = await svc.tagEntity("user", "user_456", "system");
    const emailTag = tags.find((t) => t.field === "email");
    expect(emailTag?.classification).toBe("CONFIDENTIAL");
  });

  it("computes purgeAfter for retention-bounded fields", async () => {
    const store = new InMemoryClassificationStore();
    const svc = new DataClassificationService(store as any);
    const tags = await svc.tagEntity("booking", "booking_789", "system");
    const amountTag = tags.find((t) => t.field === "totalAmount");
    expect(amountTag?.purgeAfter).toBeInstanceOf(Date);
    expect(amountTag!.purgeAfter!.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns undefined purgeAfter for UNTIL_ACCOUNT_DELETION", async () => {
    const store = new InMemoryClassificationStore();
    const svc = new DataClassificationService(store as any);
    const tags = await svc.tagEntity("user", "user_001", "system");
    const emailTag = tags.find((t) => t.field === "email");
    expect(emailTag?.purgeAfter).toBeUndefined();
  });
});
