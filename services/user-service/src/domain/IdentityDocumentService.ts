/**
 * IdentityDocumentService — WO-073: KMS envelope encryption for traveler identity docs.
 *
 * PII handling rules:
 * - Passport numbers, date of birth, and national IDs are encrypted at rest
 * - Encryption uses envelope encryption: data key from KMS, ciphertext stored in DB
 * - Only decrypted in-memory for authorized operations
 * - No raw PII in logs (enforced by observability package redaction)
 * - Access requires "read_pii" permission (ops/admin only per RBAC)
 */

export interface EncryptedIdentityDocument {
  id: string;
  userId: string;
  documentType: "passport" | "national_id" | "drivers_license";
  encryptedPayload: string; // base64-encoded envelope-encrypted ciphertext
  keyId: string; // KMS key ID used for encryption
  createdAt: Date;
  expiresAt: Date | null;
}

export interface PlainIdentityDocument {
  documentType: "passport" | "national_id" | "drivers_license";
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  nationality?: string;
  expiresAt?: string; // YYYY-MM-DD
}

export interface KmsPort {
  encrypt(plaintext: string, keyId: string): Promise<{ ciphertext: string; keyVersion: string }>;
  decrypt(ciphertext: string, keyId: string): Promise<{ plaintext: string }>;
}

export interface IdentityDocumentRepository {
  findByUserId(userId: string): Promise<EncryptedIdentityDocument[]>;
  findById(id: string): Promise<EncryptedIdentityDocument | null>;
  create(doc: Omit<EncryptedIdentityDocument, "id" | "createdAt">): Promise<EncryptedIdentityDocument>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<number>;
}

export class DocumentNotFoundError extends Error {
  constructor(id: string) {
    super(`Identity document ${id} not found`);
    this.name = "DocumentNotFoundError";
  }
}

export class IdentityDocumentService {
  constructor(
    private readonly kms: KmsPort,
    private readonly repo: IdentityDocumentRepository,
    private readonly defaultKeyId: string,
  ) {}

  async store(
    userId: string,
    doc: PlainIdentityDocument,
  ): Promise<EncryptedIdentityDocument> {
    const plaintext = JSON.stringify(doc);
    const { ciphertext } = await this.kms.encrypt(plaintext, this.defaultKeyId);

    return this.repo.create({
      userId,
      documentType: doc.documentType,
      encryptedPayload: ciphertext,
      keyId: this.defaultKeyId,
      expiresAt: doc.expiresAt ? new Date(doc.expiresAt) : null,
    });
  }

  async retrieve(id: string): Promise<PlainIdentityDocument> {
    const encrypted = await this.repo.findById(id);
    if (!encrypted) throw new DocumentNotFoundError(id);

    const { plaintext } = await this.kms.decrypt(encrypted.encryptedPayload, encrypted.keyId);
    return JSON.parse(plaintext) as PlainIdentityDocument;
  }

  async listForUser(userId: string): Promise<EncryptedIdentityDocument[]> {
    return this.repo.findByUserId(userId);
  }

  async delete(id: string): Promise<void> {
    const doc = await this.repo.findById(id);
    if (!doc) throw new DocumentNotFoundError(id);
    await this.repo.delete(id);
  }

  /** Cryptographic erasure: delete all documents for a user (GDPR right to erasure). */
  async eraseAllForUser(userId: string): Promise<number> {
    return this.repo.deleteByUserId(userId);
  }
}
