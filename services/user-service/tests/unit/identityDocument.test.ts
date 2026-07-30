import { describe, it, expect, beforeEach } from "vitest";
import {
  IdentityDocumentService,
  DocumentNotFoundError,
  type KmsPort,
  type IdentityDocumentRepository,
  type EncryptedIdentityDocument,
  type PlainIdentityDocument,
} from "../../src/domain/IdentityDocumentService.js";

// Simple XOR-based mock KMS for testing (not cryptographically secure)
const mockKms: KmsPort = {
  async encrypt(plaintext, keyId) {
    const encoded = Buffer.from(plaintext).toString("base64");
    return { ciphertext: `enc:${keyId}:${encoded}`, keyVersion: "1" };
  },
  async decrypt(ciphertext, _keyId) {
    const [, , encoded] = ciphertext.split(":");
    return { plaintext: Buffer.from(encoded!, "base64").toString("utf8") };
  },
};

class InMemoryDocRepo implements IdentityDocumentRepository {
  private store = new Map<string, EncryptedIdentityDocument>();
  private nextId = 1;

  async findByUserId(userId: string) {
    return [...this.store.values()].filter((d) => d.userId === userId);
  }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async create(doc: Omit<EncryptedIdentityDocument, "id" | "createdAt">): Promise<EncryptedIdentityDocument> {
    const id = `doc_${this.nextId++}`;
    const record = { ...doc, id, createdAt: new Date() };
    this.store.set(id, record);
    return record;
  }
  async delete(id: string) { this.store.delete(id); }
  async deleteByUserId(userId: string) {
    let count = 0;
    for (const [id, doc] of this.store) {
      if (doc.userId === userId) { this.store.delete(id); count++; }
    }
    return count;
  }
}

const PASSPORT: PlainIdentityDocument = {
  documentType: "passport",
  documentNumber: "P12345678",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-06-15",
  nationality: "US",
  expiresAt: "2030-06-15",
};

describe("IdentityDocumentService", () => {
  let svc: IdentityDocumentService;

  beforeEach(() => {
    svc = new IdentityDocumentService(mockKms, new InMemoryDocRepo(), "kms-key-001");
  });

  it("stores and retrieves a document via KMS encryption", async () => {
    const stored = await svc.store("u1", PASSPORT);
    expect(stored.encryptedPayload).toContain("enc:kms-key-001:");
    expect(stored.documentType).toBe("passport");

    const retrieved = await svc.retrieve(stored.id);
    expect(retrieved.documentNumber).toBe("P12345678");
    expect(retrieved.firstName).toBe("Jane");
  });

  it("does not expose raw PII in stored record", async () => {
    const stored = await svc.store("u1", PASSPORT);
    const payload = JSON.stringify(stored);
    expect(payload).not.toContain("P12345678");
    expect(payload).not.toContain("1990-06-15");
  });

  it("throws DocumentNotFoundError for unknown ID", async () => {
    await expect(svc.retrieve("unknown_id")).rejects.toThrow(DocumentNotFoundError);
  });

  it("lists documents for a user (without PII)", async () => {
    await svc.store("u1", PASSPORT);
    await svc.store("u1", { ...PASSPORT, documentType: "national_id" });
    const docs = await svc.listForUser("u1");
    expect(docs).toHaveLength(2);
  });

  it("deletes a specific document", async () => {
    const stored = await svc.store("u1", PASSPORT);
    await svc.delete(stored.id);
    await expect(svc.retrieve(stored.id)).rejects.toThrow(DocumentNotFoundError);
  });

  it("cryptographic erasure deletes all user documents", async () => {
    await svc.store("u1", PASSPORT);
    await svc.store("u1", { ...PASSPORT, documentType: "drivers_license" });
    const count = await svc.eraseAllForUser("u1");
    expect(count).toBe(2);
    expect(await svc.listForUser("u1")).toHaveLength(0);
  });
});
