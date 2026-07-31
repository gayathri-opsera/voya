/**
 * GdprService — WO-103: GDPR data subject access, export, and erasure endpoints.
 *
 * Implements GDPR Articles 15, 17, and 20:
 * - Article 15: Right of access — export all personal data for a subject
 * - Article 17: Right to erasure — cryptographic erasure of PII
 * - Article 20: Right to data portability — machine-readable JSON export
 *
 * All requests are logged to the compliance audit trail.
 * Response time SLA: 30 days (legal maximum).
 */

export interface GdprDataExport {
  userId: string;
  exportedAt: Date;
  data: {
    profile: unknown;
    bookings: unknown[];
    itineraries: unknown[];
    payments: unknown[];
    sessions: unknown[];
    identityDocumentMetadata: unknown[]; // NO raw PII, only metadata
  };
}

export interface GdprRepositoryPort {
  getUserProfile(userId: string): Promise<unknown>;
  getBookingsForUser(userId: string): Promise<unknown[]>;
  getItinerariesForUser(userId: string): Promise<unknown[]>;
  getPaymentMetadataForUser(userId: string): Promise<unknown[]>;
  getSessionsForUser(userId: string): Promise<unknown[]>;
  getIdentityDocumentMetadata(userId: string): Promise<unknown[]>;
  eraseUser(userId: string): Promise<void>;
  eraseBookingPii(userId: string): Promise<number>;
  eraseIdentityDocuments(userId: string): Promise<number>;
  revokeSessions(userId: string): Promise<number>;
}

export interface GdprAuditPort {
  record(entry: {
    action: "dsar_export" | "erasure_request" | "erasure_completed";
    userId: string;
    requestedBy: string;
    details?: Record<string, unknown>;
  }): Promise<void>;
}

export class GdprSubjectNotFoundError extends Error {
  constructor(userId: string) {
    super(`No data subject found for userId ${userId}`);
    this.name = "GdprSubjectNotFoundError";
  }
}

export class GdprService {
  constructor(
    private readonly repo: GdprRepositoryPort,
    private readonly audit: GdprAuditPort,
  ) {}

  async exportSubjectData(userId: string, requestedBy: string): Promise<GdprDataExport> {
    const profile = await this.repo.getUserProfile(userId);
    if (!profile) throw new GdprSubjectNotFoundError(userId);

    await this.audit.record({ action: "dsar_export", userId, requestedBy });

    const [bookings, itineraries, payments, sessions, identityDocs] = await Promise.all([
      this.repo.getBookingsForUser(userId),
      this.repo.getItinerariesForUser(userId),
      this.repo.getPaymentMetadataForUser(userId),
      this.repo.getSessionsForUser(userId),
      this.repo.getIdentityDocumentMetadata(userId),
    ]);

    return {
      userId,
      exportedAt: new Date(),
      data: {
        profile,
        bookings,
        itineraries,
        payments,
        sessions,
        identityDocumentMetadata: identityDocs,
      },
    };
  }

  async eraseSubjectData(userId: string, requestedBy: string): Promise<{
    bookingsPiiErased: number;
    identityDocumentsErased: number;
    sessionsRevoked: number;
  }> {
    await this.audit.record({ action: "erasure_request", userId, requestedBy });

    const [bookingsPiiErased, identityDocumentsErased, sessionsRevoked] = await Promise.all([
      this.repo.eraseBookingPii(userId),
      this.repo.eraseIdentityDocuments(userId),
      this.repo.revokeSessions(userId),
    ]);

    // Erase user profile last (after all PII cleanup)
    await this.repo.eraseUser(userId);

    await this.audit.record({
      action: "erasure_completed",
      userId,
      requestedBy,
      details: { bookingsPiiErased, identityDocumentsErased, sessionsRevoked },
    });

    return { bookingsPiiErased, identityDocumentsErased, sessionsRevoked };
  }
}
