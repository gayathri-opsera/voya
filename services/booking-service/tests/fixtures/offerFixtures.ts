import type { OfferSnapshot } from "../../src/domain/BookingCreationService.js";

export const AMADEUS_FLIGHT_OFFER: OfferSnapshot = {
  offerId: "offer_amadeus_001",
  provenance: "AMADEUS",
  bookable: true,
  price: { amount: 342.50, currency: "USD" },
  supplier: "Amadeus GDS",
  expiresAt: new Date("2099-12-31T23:59:59Z"), // far future — always valid in tests
  origin: "JFK",
  destination: "LAX",
  departureDate: "2026-08-15T08:00:00Z",
};

export const RAPIDAPI_HOTEL_OFFER: OfferSnapshot = {
  offerId: "offer_hotel_001",
  provenance: "RAPIDAPI_HOTEL",
  bookable: true,
  price: { amount: 189.00, currency: "USD" },
  supplier: "RapidAPI Hotels",
  expiresAt: new Date("2099-12-31T23:59:59Z"),
  hotelId: "hotel_nyc_001",
  checkIn: "2026-08-15",
  checkOut: "2026-08-18",
};

export const RAPIDAPI_CAR_OFFER: OfferSnapshot = {
  offerId: "offer_car_001",
  provenance: "RAPIDAPI_CAR",
  bookable: true,
  price: { amount: 75.00, currency: "USD" },
  supplier: "RapidAPI Cars",
  expiresAt: null,
  carClass: "STANDARD",
  pickupLocation: "JFK",
  dropoffLocation: "LAX",
};

export const ILLUSTRATIVE_OFFER: OfferSnapshot = {
  offerId: "offer_illustrative_001",
  provenance: "ILLUSTRATIVE",
  bookable: false,
  price: { amount: 250.00, currency: "USD" },
  supplier: "AI-generated",
  expiresAt: null,
};

export const EXPIRED_OFFER: OfferSnapshot = {
  offerId: "offer_expired_001",
  provenance: "AMADEUS",
  bookable: true,
  price: { amount: 299.00, currency: "USD" },
  supplier: "Amadeus GDS",
  expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
};
