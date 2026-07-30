import { describe, it, expect, beforeEach } from "vitest";
import {
  ItineraryService,
  ItineraryNotFoundError,
  ItineraryAccessDeniedError,
  MultiCurrencyError,
  type Itinerary,
  type ItineraryRepositoryPort,
  type ItineraryBookingRef,
} from "../../src/domain/ItineraryService.js";

class InMemoryItineraryRepo implements ItineraryRepositoryPort {
  private store = new Map<string, Itinerary>();
  private nextId = 1;

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByOwnerId(ownerId: string) {
    return [...this.store.values()].filter(i => i.ownerId === ownerId);
  }
  async create(input: Omit<Itinerary, "id" | "createdAt" | "updatedAt">): Promise<Itinerary> {
    const id = `itin_${this.nextId++}`;
    const now = new Date();
    const record: Itinerary = { ...input, id, createdAt: now, updatedAt: now };
    this.store.set(id, record);
    return record;
  }
  async update(id: string, patch: Partial<Pick<Itinerary, "name" | "bookings">>): Promise<Itinerary> {
    const existing = this.store.get(id)!;
    const updated = { ...existing, ...patch, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }
  async delete(id: string) { this.store.delete(id); }
}

const flightBooking: ItineraryBookingRef = {
  bookingId: "b1", amount: 300, currency: "USD", type: "flight", status: "CONFIRMED",
};
const hotelBooking: ItineraryBookingRef = {
  bookingId: "b2", amount: 150, currency: "USD", type: "hotel", status: "CONFIRMED",
};
const euroBooking: ItineraryBookingRef = {
  bookingId: "b3", amount: 100, currency: "EUR", type: "hotel", status: "CONFIRMED",
};

describe("ItineraryService", () => {
  let svc: ItineraryService;

  beforeEach(() => { svc = new ItineraryService(new InMemoryItineraryRepo()); });

  it("creates an itinerary with computed total", async () => {
    const result = await svc.create({
      ownerId: "u1", name: "Paris Trip", bookings: [flightBooking, hotelBooking],
    });
    expect(result.totalAmount).toBe(450);
    expect(result.currency).toBe("USD");
  });

  it("rejects multi-currency bookings", async () => {
    await expect(
      svc.create({ ownerId: "u1", name: "Mixed", bookings: [flightBooking, euroBooking] }),
    ).rejects.toThrow(MultiCurrencyError);
  });

  it("owner can read their itinerary", async () => {
    const created = await svc.create({ ownerId: "u1", name: "Trip", bookings: [flightBooking] });
    const result = await svc.get(created.id, "u1", "traveler");
    expect(result.id).toBe(created.id);
  });

  it("non-owner cannot read itinerary", async () => {
    const created = await svc.create({ ownerId: "u1", name: "Trip", bookings: [flightBooking] });
    await expect(svc.get(created.id, "u2", "traveler")).rejects.toThrow(ItineraryAccessDeniedError);
  });

  it("support_agent can read any itinerary", async () => {
    const created = await svc.create({ ownerId: "u1", name: "Trip", bookings: [flightBooking] });
    const result = await svc.get(created.id, "agent1", "support_agent");
    expect(result.id).toBe(created.id);
  });

  it("throws ItineraryNotFoundError for unknown ID", async () => {
    await expect(svc.get("unknown", "u1", "traveler")).rejects.toThrow(ItineraryNotFoundError);
  });

  it("owner can delete their itinerary", async () => {
    const created = await svc.create({ ownerId: "u1", name: "Trip", bookings: [flightBooking] });
    await svc.delete(created.id, "u1", "traveler");
    await expect(svc.get(created.id, "u1", "traveler")).rejects.toThrow(ItineraryNotFoundError);
  });

  it("non-owner cannot delete itinerary", async () => {
    const created = await svc.create({ ownerId: "u1", name: "Trip", bookings: [flightBooking] });
    await expect(svc.delete(created.id, "u2", "traveler")).rejects.toThrow(ItineraryAccessDeniedError);
  });
});
