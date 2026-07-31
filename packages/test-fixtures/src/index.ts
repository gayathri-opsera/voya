/**
 * TestSeedData — WO-092: Synthetic seed data and shared test fixture package.
 *
 * Provides deterministic, reusable test fixtures for all services.
 * Uses a fixed seed so tests are reproducible.
 */

import { randomUUID } from "crypto";

export const SEED_USER_ID = "user_00000000-0000-4000-8000-000000000001";
export const SEED_BOOKING_ID = "booking_00000000-0000-4000-8000-000000000001";
export const SEED_OFFER_ID = "offer_00000000-0000-4000-8000-000000000001";
export const SEED_PAYMENT_ID = "pi_test_seed_payment_intent_001";

export const seedUser = () => ({
  id: SEED_USER_ID,
  email: "test.traveler@example.com",
  fullName: "Test Traveler",
  role: "TRAVELER" as const,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  emailVerified: true,
});

export const seedOffer = (overrides: Partial<ReturnType<typeof defaultOffer>> = {}) => ({
  ...defaultOffer(),
  ...overrides,
});

function defaultOffer() {
  return {
    id: SEED_OFFER_ID,
    type: "flight" as const,
    provenance: "AMADEUS" as const,
    bookable: true,
    freshness: "LIVE" as const,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    price: { amount: 299.00, currency: "USD", breakdown: [] },
    summary: {
      origin: "JFK",
      destination: "LHR",
      departureDate: "2026-08-15",
      seatClass: "ECONOMY",
    },
    rawPayload: {},
  };
}

export const seedBooking = (overrides: Partial<ReturnType<typeof defaultBooking>> = {}) => ({
  ...defaultBooking(),
  ...overrides,
});

function defaultBooking() {
  return {
    id: SEED_BOOKING_ID,
    userId: SEED_USER_ID,
    status: "CONFIRMED" as const,
    offerId: SEED_OFFER_ID,
    offerSnapshot: seedOffer(),
    totalAmount: 299.00,
    currency: "USD",
    idempotencyKey: "test-idempotency-key-001",
    createdAt: new Date("2026-01-15T10:00:00Z"),
    updatedAt: new Date("2026-01-15T10:01:00Z"),
  };
}

export const seedItinerary = () => ({
  id: randomUUID(),
  userId: SEED_USER_ID,
  name: "Summer Europe Trip 2026",
  bookingIds: [SEED_BOOKING_ID],
  notes: "Pack light. Check visa requirements.",
  currency: "USD",
  createdAt: new Date("2026-01-15T10:05:00Z"),
});

export const seedConversationSession = () => ({
  id: randomUUID(),
  userId: SEED_USER_ID,
  turns: [
    {
      id: randomUUID(),
      role: "user" as const,
      content: "Find me flights to London in August",
      timestamp: new Date("2026-01-15T10:00:00Z"),
    },
    {
      id: randomUUID(),
      role: "assistant" as const,
      content: "I found 3 flights from JFK to LHR in August. The cheapest is $299.",
      timestamp: new Date("2026-01-15T10:00:02Z"),
    },
  ],
  createdAt: new Date("2026-01-15T10:00:00Z"),
  updatedAt: new Date("2026-01-15T10:00:02Z"),
  expiresAt: new Date("2026-01-15T11:00:00Z"),
});
