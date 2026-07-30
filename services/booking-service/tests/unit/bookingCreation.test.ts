import { describe, it, expect, beforeEach } from "vitest";
import {
  BookingCreationService,
  OfferNotBookableError,
  OfferExpiredError,
  OfferNotFoundError,
  DuplicateBookingError,
  type OfferPort,
  type BookingCreationRepositoryPort,
  type CreatedBooking,
  type OfferSnapshot,
} from "../../src/domain/BookingCreationService.js";
import { InMemoryAuditStore, AuditWriter } from "../../src/domain/AuditWriter.js";
import {
  AMADEUS_FLIGHT_OFFER,
  ILLUSTRATIVE_OFFER,
  EXPIRED_OFFER,
  RAPIDAPI_HOTEL_OFFER,
} from "../fixtures/offerFixtures.js";

// ─── In-memory fakes ──────────────────────────────────────────────────────────

class InMemoryOfferPort implements OfferPort {
  private readonly offers = new Map<string, OfferSnapshot>();

  seed(offer: OfferSnapshot) { this.offers.set(offer.offerId, offer); }

  async resolveOffer(offerId: string): Promise<OfferSnapshot | null> {
    return this.offers.get(offerId) ?? null;
  }
}

class InMemoryBookingRepo implements BookingCreationRepositoryPort {
  private readonly store = new Map<string, CreatedBooking>();
  private readonly idempotencyIndex = new Map<string, string>();
  private nextId = 1;

  async findByIdempotencyKey(key: string): Promise<CreatedBooking | null> {
    const id = this.idempotencyIndex.get(key);
    return id ? (this.store.get(id) ?? null) : null;
  }

  async create(input: Parameters<BookingCreationRepositoryPort["create"]>[0]): Promise<CreatedBooking> {
    const id = `book_${this.nextId++}`;
    const booking: CreatedBooking = {
      id,
      status: "PENDING",
      totalPrice: input.offerSnapshot.price.amount,
      currency: input.offerSnapshot.price.currency,
      expiresAt: input.expiresAt,
      offerSnapshot: input.offerSnapshot,
      provenance: input.provenance,
    };
    this.store.set(id, booking);
    this.idempotencyIndex.set(input.idempotencyKey, id);
    return booking;
  }
}

function makeService() {
  const offerPort = new InMemoryOfferPort();
  const bookingRepo = new InMemoryBookingRepo();
  const auditStore = new InMemoryAuditStore();
  const auditWriter = new AuditWriter(auditStore);
  const clock = { now: () => new Date("2026-08-01T10:00:00Z") };
  const svc = new BookingCreationService(offerPort, bookingRepo, auditWriter, clock);
  return { offerPort, bookingRepo, auditStore, svc };
}

const BASE_INPUT = {
  offerIds: [AMADEUS_FLIGHT_OFFER.offerId],
  travelers: [{ firstName: "Alice", lastName: "Smith", email: "alice@example.com" }],
  idempotencyKey: "key_001",
  userId: "user_abc",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BookingCreationService — happy path", () => {
  it("creates a PENDING booking with immutable offer snapshot", async () => {
    const { offerPort, svc } = makeService();
    offerPort.seed(AMADEUS_FLIGHT_OFFER);

    const result = await svc.create(BASE_INPUT);

    expect(result.status).toBe("PENDING");
    expect(result.provenance).toBe("AMADEUS");
    expect(result.offerSnapshot.offerId).toBe(AMADEUS_FLIGHT_OFFER.offerId);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("expiresAt is set to now + 30 minutes", async () => {
    const { offerPort, svc } = makeService();
    offerPort.seed(AMADEUS_FLIGHT_OFFER);

    const result = await svc.create(BASE_INPUT);
    const thirtyMin = 30 * 60 * 1000;
    const expected = new Date("2026-08-01T10:00:00Z").getTime() + thirtyMin;
    expect(result.expiresAt.getTime()).toBe(expected);
  });

  it("writes an audit row for booking creation", async () => {
    const { offerPort, auditStore, svc } = makeService();
    offerPort.seed(AMADEUS_FLIGHT_OFFER);

    await svc.create(BASE_INPUT);

    expect(auditStore.rows).toHaveLength(1);
    expect(auditStore.rows[0]!.actorRole).toBe("traveler");
    expect(auditStore.rows[0]!.resourceType).toBe("booking");
  });

  it("audit row does not contain PII", async () => {
    const { offerPort, auditStore, svc } = makeService();
    offerPort.seed(AMADEUS_FLIGHT_OFFER);

    await svc.create(BASE_INPUT);

    const row = auditStore.rows[0]!;
    const newStateStr = JSON.stringify(row.sanitisedNew);
    expect(newStateStr).not.toContain("alice@example.com");
  });
});

describe("BookingCreationService — ILLUSTRATIVE rejection", () => {
  it("rejects ILLUSTRATIVE offer with OfferNotBookableError", async () => {
    const { offerPort, svc } = makeService();
    offerPort.seed(ILLUSTRATIVE_OFFER);

    await expect(
      svc.create({ ...BASE_INPUT, offerIds: [ILLUSTRATIVE_OFFER.offerId] }),
    ).rejects.toThrow(OfferNotBookableError);
  });

  it("writes no booking row when ILLUSTRATIVE is rejected", async () => {
    const { offerPort, bookingRepo, svc } = makeService();
    offerPort.seed(ILLUSTRATIVE_OFFER);

    try {
      await svc.create({ ...BASE_INPUT, offerIds: [ILLUSTRATIVE_OFFER.offerId] });
    } catch {
      // expected
    }

    const booking = await bookingRepo.findByIdempotencyKey(BASE_INPUT.idempotencyKey);
    expect(booking).toBeNull();
  });
});

describe("BookingCreationService — expired offer", () => {
  it("rejects an expired offer with OfferExpiredError", async () => {
    const { offerPort, svc } = makeService();
    offerPort.seed(EXPIRED_OFFER);

    await expect(
      svc.create({ ...BASE_INPUT, offerIds: [EXPIRED_OFFER.offerId] }),
    ).rejects.toThrow(OfferExpiredError);
  });
});

describe("BookingCreationService — unknown offer", () => {
  it("throws OfferNotFoundError for unknown offer ID", async () => {
    const { svc } = makeService();
    await expect(svc.create(BASE_INPUT)).rejects.toThrow(OfferNotFoundError);
  });
});

describe("BookingCreationService — idempotency", () => {
  it("throws DuplicateBookingError on duplicate idempotency key", async () => {
    const { offerPort, svc } = makeService();
    offerPort.seed(AMADEUS_FLIGHT_OFFER);

    await svc.create(BASE_INPUT);

    await expect(svc.create(BASE_INPUT)).rejects.toThrow(DuplicateBookingError);
  });
});
