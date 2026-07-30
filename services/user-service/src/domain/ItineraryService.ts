/**
 * ItineraryService — WO-053: Itinerary CRUD with ownership and multi-currency.
 *
 * An Itinerary groups one or more bookings into a logical trip.
 * - Ownership enforced: only the owner or ops can read/modify
 * - Totals computed in a single currency (mixed currencies produce error)
 * - Idempotent create via idempotency key
 */

export interface ItineraryBookingRef {
  bookingId: string;
  amount: number;
  currency: string;
  type: "flight" | "hotel" | "car";
  status: string;
}

export interface Itinerary {
  id: string;
  ownerId: string;
  name: string;
  bookings: ItineraryBookingRef[];
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItineraryRepositoryPort {
  findById(id: string): Promise<Itinerary | null>;
  findByOwnerId(ownerId: string): Promise<Itinerary[]>;
  create(input: Omit<Itinerary, "id" | "createdAt" | "updatedAt">): Promise<Itinerary>;
  update(id: string, patch: Partial<Pick<Itinerary, "name" | "bookings">>): Promise<Itinerary>;
  delete(id: string): Promise<void>;
}

export class ItineraryNotFoundError extends Error {
  constructor(id: string) {
    super(`Itinerary ${id} not found`);
    this.name = "ItineraryNotFoundError";
  }
}

export class ItineraryAccessDeniedError extends Error {
  constructor(actorId: string, itineraryId: string) {
    super(`Actor ${actorId} does not own itinerary ${itineraryId}`);
    this.name = "ItineraryAccessDeniedError";
  }
}

export class MultiCurrencyError extends Error {
  constructor(currencies: string[]) {
    super(`Itinerary bookings span multiple currencies: ${currencies.join(", ")}`);
    this.name = "MultiCurrencyError";
  }
}

function computeTotal(bookings: ItineraryBookingRef[]): { total: number; currency: string } {
  if (bookings.length === 0) return { total: 0, currency: "USD" };
  const currencies = new Set(bookings.map((b) => b.currency));
  if (currencies.size > 1) throw new MultiCurrencyError([...currencies]);
  return {
    total: bookings.reduce((sum, b) => sum + b.amount, 0),
    currency: [...currencies][0]!,
  };
}

export class ItineraryService {
  constructor(private readonly repo: ItineraryRepositoryPort) {}

  async create(input: {
    ownerId: string;
    name: string;
    bookings: ItineraryBookingRef[];
  }): Promise<Itinerary> {
    const { total, currency } = computeTotal(input.bookings);
    return this.repo.create({
      ownerId: input.ownerId,
      name: input.name,
      bookings: input.bookings,
      totalAmount: total,
      currency,
    });
  }

  async get(id: string, actorId: string, actorRole: string): Promise<Itinerary> {
    const itinerary = await this.repo.findById(id);
    if (!itinerary) throw new ItineraryNotFoundError(id);
    if (actorRole !== "ops" && actorRole !== "support_agent" && itinerary.ownerId !== actorId) {
      throw new ItineraryAccessDeniedError(actorId, id);
    }
    return itinerary;
  }

  async listForOwner(ownerId: string): Promise<Itinerary[]> {
    return this.repo.findByOwnerId(ownerId);
  }

  async update(
    id: string,
    actorId: string,
    actorRole: string,
    patch: Partial<Pick<Itinerary, "name" | "bookings">>,
  ): Promise<Itinerary> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ItineraryNotFoundError(id);
    if (actorRole !== "ops" && existing.ownerId !== actorId) {
      throw new ItineraryAccessDeniedError(actorId, id);
    }
    return this.repo.update(id, patch);
  }

  async delete(id: string, actorId: string, actorRole: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ItineraryNotFoundError(id);
    if (actorRole !== "ops" && existing.ownerId !== actorId) {
      throw new ItineraryAccessDeniedError(actorId, id);
    }
    return this.repo.delete(id);
  }
}
