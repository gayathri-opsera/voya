/**
 * RetentionPurgeJob — WO-075: Automated retention purge with cryptographic erasure.
 *
 * Implements GDPR Article 17 (right to erasure) and internal data retention policy:
 * - Soft-deleted users: purge after 30 days
 * - Expired identity documents: purge immediately
 * - Anonymize booking records older than retention period (keep aggregate data)
 * - Use KMS key deletion for cryptographic erasure of PII
 *
 * Every purge run is logged to the audit trail for compliance evidence.
 */

export interface RetentionPolicy {
  softDeletedUserRetentionDays: number;
  identityDocumentRetentionDays: number;
  bookingAnonymizationDays: number;
}

export interface PurgeReport {
  runAt: Date;
  usersErased: number;
  identityDocsPurged: number;
  bookingsAnonymized: number;
  errors: string[];
}

export interface RetentionDataPort {
  getSoftDeletedUsersBefore(date: Date): Promise<{ userId: string }[]>;
  getExpiredIdentityDocs(before: Date): Promise<{ id: string; userId: string }[]>;
  getBookingsOlderThan(date: Date): Promise<{ bookingId: string }[]>;
  eraseUser(userId: string): Promise<void>;
  deleteIdentityDoc(id: string): Promise<void>;
  anonymizeBooking(bookingId: string): Promise<void>;
}

export interface PurgeAuditPort {
  record(entry: {
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
  }): Promise<void>;
}

export class RetentionPurgeJob {
  constructor(
    private readonly data: RetentionDataPort,
    private readonly audit: PurgeAuditPort,
    private readonly policy: RetentionPolicy = {
      softDeletedUserRetentionDays: 30,
      identityDocumentRetentionDays: 365 * 7,
      bookingAnonymizationDays: 365 * 7,
    },
  ) {}

  async run(now: Date = new Date()): Promise<PurgeReport> {
    const report: PurgeReport = {
      runAt: now,
      usersErased: 0,
      identityDocsPurged: 0,
      bookingsAnonymized: 0,
      errors: [],
    };

    const userCutoff = new Date(now);
    userCutoff.setDate(userCutoff.getDate() - this.policy.softDeletedUserRetentionDays);

    const docCutoff = new Date(now);
    const bookingCutoff = new Date(now);
    bookingCutoff.setDate(bookingCutoff.getDate() - this.policy.bookingAnonymizationDays);

    // Purge soft-deleted users
    try {
      const users = await this.data.getSoftDeletedUsersBefore(userCutoff);
      for (const { userId } of users) {
        try {
          await this.data.eraseUser(userId);
          await this.audit.record({
            action: "user_erased",
            targetType: "user",
            targetId: userId,
            reason: "soft_delete_retention_expired",
          });
          report.usersErased++;
        } catch (err) {
          report.errors.push(`Failed to erase user ${userId}: ${String(err)}`);
        }
      }
    } catch (err) {
      report.errors.push(`Failed to fetch soft-deleted users: ${String(err)}`);
    }

    // Purge expired identity documents
    try {
      const docs = await this.data.getExpiredIdentityDocs(docCutoff);
      for (const { id, userId } of docs) {
        try {
          await this.data.deleteIdentityDoc(id);
          await this.audit.record({
            action: "identity_doc_purged",
            targetType: "identity_document",
            targetId: id,
            reason: `owner=${userId} doc_expired`,
          });
          report.identityDocsPurged++;
        } catch (err) {
          report.errors.push(`Failed to purge identity doc ${id}: ${String(err)}`);
        }
      }
    } catch (err) {
      report.errors.push(`Failed to fetch expired identity docs: ${String(err)}`);
    }

    // Anonymize old bookings
    try {
      const bookings = await this.data.getBookingsOlderThan(bookingCutoff);
      for (const { bookingId } of bookings) {
        try {
          await this.data.anonymizeBooking(bookingId);
          await this.audit.record({
            action: "booking_anonymized",
            targetType: "booking",
            targetId: bookingId,
            reason: "retention_policy_7yr",
          });
          report.bookingsAnonymized++;
        } catch (err) {
          report.errors.push(`Failed to anonymize booking ${bookingId}: ${String(err)}`);
        }
      }
    } catch (err) {
      report.errors.push(`Failed to fetch old bookings: ${String(err)}`);
    }

    return report;
  }
}
