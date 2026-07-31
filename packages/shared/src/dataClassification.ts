/**
 * DataClassificationService — WO-074/WO-102: Data classification tagging
 * and automated retention purge scheduling.
 *
 * Classifies data fields according to sensitivity, attaches retention metadata,
 * and schedules purge-after dates for PII records.
 */

export type DataClass =
  | "PUBLIC"           // No restrictions
  | "INTERNAL"         // Internal use only
  | "CONFIDENTIAL"     // PII — encrypted at rest, access-logged
  | "RESTRICTED";      // Financial/health data — requires explicit authorization

export type RetentionPolicy =
  | "RETAIN_7_DAYS"
  | "RETAIN_30_DAYS"
  | "RETAIN_90_DAYS"
  | "RETAIN_1_YEAR"
  | "RETAIN_7_YEARS"   // Financial records
  | "UNTIL_ACCOUNT_DELETION";

export interface DataClassificationTag {
  entityType: string;
  entityId: string;
  field: string;
  classification: DataClass;
  retentionPolicy: RetentionPolicy;
  purgeAfter?: Date;
  taggedAt: Date;
  taggedBy: string;
}

export interface ClassificationStore {
  save(tag: DataClassificationTag): Promise<void>;
  findByEntity(entityType: string, entityId: string): Promise<DataClassificationTag[]>;
  findDueToPurge(before: Date): Promise<DataClassificationTag[]>;
}

/** Field classification definitions by entity type. */
export const FIELD_CLASSIFICATIONS: Record<string, Record<string, { class: DataClass; retention: RetentionPolicy }>> = {
  user: {
    email:          { class: "CONFIDENTIAL",  retention: "UNTIL_ACCOUNT_DELETION" },
    fullName:       { class: "CONFIDENTIAL",  retention: "UNTIL_ACCOUNT_DELETION" },
    phoneNumber:    { class: "CONFIDENTIAL",  retention: "UNTIL_ACCOUNT_DELETION" },
    passwordHash:   { class: "RESTRICTED",    retention: "UNTIL_ACCOUNT_DELETION" },
    dateOfBirth:    { class: "CONFIDENTIAL",  retention: "UNTIL_ACCOUNT_DELETION" },
  },
  booking: {
    travellerName:  { class: "CONFIDENTIAL",  retention: "RETAIN_7_YEARS" },
    passengerDob:   { class: "CONFIDENTIAL",  retention: "RETAIN_7_YEARS" },
    totalAmount:    { class: "RESTRICTED",    retention: "RETAIN_7_YEARS" },
    supplierId:     { class: "INTERNAL",      retention: "RETAIN_7_YEARS" },
  },
  identity_document: {
    documentNumber: { class: "RESTRICTED",    retention: "RETAIN_7_YEARS" },
    nationality:    { class: "CONFIDENTIAL",  retention: "RETAIN_7_YEARS" },
    expiryDate:     { class: "CONFIDENTIAL",  retention: "RETAIN_7_YEARS" },
  },
  payment: {
    cardLast4:      { class: "RESTRICTED",    retention: "RETAIN_7_YEARS" },
    stripePaymentId:{ class: "CONFIDENTIAL",  retention: "RETAIN_7_YEARS" },
  },
};

export class DataClassificationService {
  constructor(private readonly store: ClassificationStore) {}

  async tagEntity(
    entityType: string,
    entityId: string,
    taggedBy: string,
  ): Promise<DataClassificationTag[]> {
    const fieldDefs = FIELD_CLASSIFICATIONS[entityType] ?? {};
    const tags: DataClassificationTag[] = [];

    for (const [field, def] of Object.entries(fieldDefs)) {
      const purgeAfter = this.computePurgeAfter(def.retention);
      const tag: DataClassificationTag = {
        entityType,
        entityId,
        field,
        classification: def.class,
        retentionPolicy: def.retention,
        purgeAfter,
        taggedAt: new Date(),
        taggedBy,
      };
      await this.store.save(tag);
      tags.push(tag);
    }

    return tags;
  }

  async getTagsForEntity(entityType: string, entityId: string): Promise<DataClassificationTag[]> {
    return this.store.findByEntity(entityType, entityId);
  }

  async findDueToPurge(): Promise<DataClassificationTag[]> {
    return this.store.findDueToPurge(new Date());
  }

  private computePurgeAfter(policy: RetentionPolicy): Date | undefined {
    const now = Date.now();
    const MS = 1;
    const SECOND = 1000 * MS;
    const DAY = 86400 * SECOND;
    const YEAR = 365 * DAY;

    switch (policy) {
      case "RETAIN_7_DAYS":          return new Date(now + 7 * DAY);
      case "RETAIN_30_DAYS":         return new Date(now + 30 * DAY);
      case "RETAIN_90_DAYS":         return new Date(now + 90 * DAY);
      case "RETAIN_1_YEAR":          return new Date(now + 1 * YEAR);
      case "RETAIN_7_YEARS":         return new Date(now + 7 * YEAR);
      case "UNTIL_ACCOUNT_DELETION": return undefined; // No date — triggered by account deletion
    }
  }
}
