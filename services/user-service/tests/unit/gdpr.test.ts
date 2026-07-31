import { describe, it, expect, beforeEach } from "vitest";
import {
  GdprService,
  GdprSubjectNotFoundError,
  type GdprRepositoryPort,
  type GdprAuditPort,
} from "../../src/domain/GdprService.js";

function makeRepo(hasUser = true): GdprRepositoryPort {
  return {
    async getUserProfile(id) { return hasUser ? { id, email: "test@example.com" } : null; },
    async getBookingsForUser() { return [{ id: "b1" }, { id: "b2" }]; },
    async getItinerariesForUser() { return [{ id: "i1" }]; },
    async getPaymentMetadataForUser() { return [{ id: "pay1" }]; },
    async getSessionsForUser() { return [{ id: "sess1" }]; },
    async getIdentityDocumentMetadata() { return [{ id: "doc1", documentType: "passport" }]; },
    async eraseUser() {},
    async eraseBookingPii() { return 2; },
    async eraseIdentityDocuments() { return 1; },
    async revokeSessions() { return 3; },
  };
}

class InMemoryAuditPort implements GdprAuditPort {
  entries: { action: string; userId: string }[] = [];
  async record(e: { action: string; userId: string; requestedBy: string }) {
    this.entries.push(e);
  }
}

describe("GdprService", () => {
  let audit: InMemoryAuditPort;
  let svc: GdprService;

  beforeEach(() => {
    audit = new InMemoryAuditPort();
    svc = new GdprService(makeRepo(), audit);
  });

  it("exports all subject data categories", async () => {
    const result = await svc.exportSubjectData("u1", "user_self");
    expect(result.data.profile).toBeDefined();
    expect(result.data.bookings).toHaveLength(2);
    expect(result.data.itineraries).toHaveLength(1);
    expect(result.data.payments).toHaveLength(1);
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.identityDocumentMetadata).toHaveLength(1);
  });

  it("logs DSAR export to audit trail", async () => {
    await svc.exportSubjectData("u1", "admin");
    expect(audit.entries.some((e) => e.action === "dsar_export")).toBe(true);
  });

  it("throws GdprSubjectNotFoundError for unknown userId", async () => {
    const svcNoUser = new GdprService(makeRepo(false), audit);
    await expect(svcNoUser.exportSubjectData("unknown", "admin")).rejects.toThrow(GdprSubjectNotFoundError);
  });

  it("erasure erases PII, identity docs, and sessions", async () => {
    const result = await svc.eraseSubjectData("u1", "user_self");
    expect(result.bookingsPiiErased).toBe(2);
    expect(result.identityDocumentsErased).toBe(1);
    expect(result.sessionsRevoked).toBe(3);
  });

  it("logs both erasure request and completion to audit trail", async () => {
    await svc.eraseSubjectData("u1", "user_self");
    const actions = audit.entries.map((e) => e.action);
    expect(actions).toContain("erasure_request");
    expect(actions).toContain("erasure_completed");
  });
});
