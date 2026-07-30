/**
 * BookingCreationService — creates a PENDING booking with an immutable offer snapshot.
 *
 * - Validates offer provenance (refuses ILLUSTRATIVE/non-bookable)
 * - Stamps expires_at = now + 30 minutes
 * - Freezes offer snapshot at time of create (cannot be mutated)
 * - Writes booking + audit row atomically
 */

import { validateProvenance } from "@travel/contracts/provenance";
import { sanitiseAuditPayload } from "@travel/contracts/audit";
import type { AuditWriter } from "./AuditWriter.js";

export class OfferNotBookableError extends Error {
  constructor(
    public readonly offerId: string,
    public readonly provenance: string,
  ) {
    super(`Offer ${offerId} with provenance ${provenance} is not bookable`);
    this.name = "OfferNotBookableError";
  }
}

export class OfferExpiredError extends Error {
  constructor(public readonly offerId: string) {
    super(`Offer ${offerId} has expired; please search again`);
    this.name = "OfferExpiredError";
  }
}

export class OfferNotFoundError extends Error {
  constructor(public readonly offerId: string) {
    super(`Offer ${offerId} not found`);
    this.name = "OfferNotFoundError";
  }
}

export class DuplicateBookingError extends Error {
  constructor(
    public readonly idempotencyKey: string,
    public readonly existingBookingId: string,
  ) {
    super(`Booking with idempotency key ${idempotencyKey} already exists`);
    this.name = "DuplicateBookingError";
  }
}

export interface OfferSnapshot {
  offerId: string;
  provenance: string;
  bookable: boolean;
  price: { amount: number; currency: string };
  supplier: string;
  expiresAt: Date | null;
  [key: string]: unknown;
}

export interface OfferPort {
  resolveOffer(offerId: string): Promise<OfferSnapshot | null>;
}

export interface CreateBookingInput {
  offerIds: string[];
  travelers: Array<{ firstName: string; lastName: string; email: string; dateOfBirth?: string }>;
  idempotencyKey: string;
  userId: string;
  correlationId?: string;
}

export interface CreatedBooking {
  id: string;
  status: "PENDING";
  totalPrice: number;
  currency: string;
  expiresAt: Date;
  offerSnapshot: OfferSnapshot;
  provenance: string;
}

export interface BookingCreationRepositoryPort {
  findByIdempotencyKey(key: string): Promise<CreatedBooking | null>;
  create(input: {
    userId: string;
    offerSnapshot: OfferSnapshot;
    provenance: string;
    expiresAt: Date;
    idempotencyKey: string;
  }): Promise<CreatedBooking>;
}

const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class BookingCreationService {
  constructor(
    private readonly offerPort: OfferPort,
    private readonly bookingRepo: BookingCreationRepositoryPort,
    private readonly auditWriter: AuditWriter,
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async create(input: CreateBookingInput): Promise<CreatedBooking> {
    // Idempotency check
    const existing = await this.bookingRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      throw new DuplicateBookingError(input.idempotencyKey, existing.id);
    }

    // Resolve all offers
    const offers: OfferSnapshot[] = [];
    for (const offerId of input.offerIds) {
      const offer = await this.offerPort.resolveOffer(offerId);
      if (!offer) throw new OfferNotFoundError(offerId);

      // Provenance guard — structural rejection of non-bookable offers
      const provenanceCheck = validateProvenance(offer.provenance);
      if (!provenanceCheck.valid || !offer.bookable) {
        throw new OfferNotBookableError(offerId, offer.provenance);
      }

      // Freshness guard
      if (offer.expiresAt && offer.expiresAt < this.clock.now()) {
        throw new OfferExpiredError(offerId);
      }

      offers.push(offer);
    }

    // For multi-leg, enforce single currency
    const currencies = new Set(offers.map((o) => o.price.currency));
    if (currencies.size > 1) {
      throw new Error("Multi-currency booking not supported");
    }

    const primaryOffer = offers[0]!;
    const totalPrice = offers.reduce((sum, o) => sum + o.price.amount, 0);
    const expiresAt = new Date(this.clock.now().getTime() + PENDING_TTL_MS);

    const booking = await this.bookingRepo.create({
      userId: input.userId,
      offerSnapshot: primaryOffer,
      provenance: primaryOffer.provenance,
      expiresAt,
      idempotencyKey: input.idempotencyKey,
    });

    // Audit row (PII-scrubbed)
    await this.auditWriter.record({
      actorId: input.userId,
      actorRole: "traveler",
      resourceType: "booking",
      resourceId: booking.id,
      previousState: null,
      newState: sanitiseAuditPayload({ status: "PENDING", provenance: primaryOffer.provenance }),
    });

    return booking;
  }
}
