import type {
  FlightSearchRequest,
  HotelSearchRequest,
  CarRentalSearchRequest,
  UnifiedOffer,
  SearchResponse,
} from "../../src/search/index.js";

// ─── Valid fixtures ───────────────────────────────────────────────────────────

export const validFlightSearch: FlightSearchRequest = {
  origin: new Date("2099-01-01T00:00:00.000Z") as unknown as Date, // placeholder — built from schema
  destination: new Date("2099-01-01T00:00:00.000Z") as unknown as Date,
  departureDate: new Date("2099-06-15T00:00:00.000Z"),
  returnDate: new Date("2099-06-22T00:00:00.000Z"),
  passengers: 2,
  seatClass: "ECONOMY",
  currency: new Date("2099-01-01T00:00:00.000Z") as unknown as Date,
};

/**
 * Raw JSON payloads — as received from the browser (strings, not Dates).
 * These are the canonical fixtures for testing schema.parse().
 */
export const rawFlightSearchPayload = {
  origin: "JFK",
  destination: "LHR",
  departureDate: "2099-06-15",
  returnDate: "2099-06-22",
  passengers: 2,
  seatClass: "ECONOMY",
  currency: "USD",
};

export const rawHotelSearchPayload = {
  destination: "Paris, France",
  checkInDate: "2099-07-01",
  checkOutDate: "2099-07-05",
  guests: 2,
  starRating: 4,
  currency: "EUR",
};

export const rawCarSearchPayload = {
  pickupLocation: "London Heathrow Airport",
  dropoffLocation: "London City Airport",
  pickupDate: "2099-08-01",
  dropoffDate: "2099-08-07",
  carClass: "MIDSIZE",
  currency: "GBP",
};

export const rawFlightOfferPayload = {
  id: "offer_01J9X0Y2Z3A4B5C6D7E8F9G0H1",
  provenance: "AMADEUS",
  bookable: true,
  title: "British Airways JFK → LHR",
  price: "450.00",
  currency: "USD",
  rating: 4.2,
  reviews: 1250,
  details: {
    airline: "British Airways",
    flightNumber: "BA178",
    departureAirport: "JFK",
    arrivalAirport: "LHR",
    departureTime: "2099-06-15T21:00:00Z",
    arrivalTime: "2099-06-16T09:00:00Z",
    duration: "7h 00m",
    stops: 0,
    seatClass: "ECONOMY",
  },
  expiresAt: "2099-06-14T21:00:00.000Z",
  freshness: "FRESH",
};

export const rawIllustrativeOfferPayload = {
  id: "offer_illustrative_01",
  provenance: "ILLUSTRATIVE",
  bookable: false,
  title: "Sample Hotel Offer (not bookable)",
  price: "120.00",
  currency: "USD",
  details: {
    hotelName: "Example Hotel",
    address: "123 Main St",
    starRating: 3,
    roomType: "Standard",
    breakfastIncluded: false,
  },
  expiresAt: "2099-12-31T23:59:59.000Z",
  freshness: "FRESH",
};

// ─── Invalid fixtures ─────────────────────────────────────────────────────────

export const invalidFlightSearch = {
  fourLetterAirport: { ...rawFlightSearchPayload, origin: "JFKK" },
  lowercaseAirport: { ...rawFlightSearchPayload, origin: "jfk" },
  zeroPassengers: { ...rawFlightSearchPayload, passengers: 0 },
  tenPassengers: { ...rawFlightSearchPayload, passengers: 10 },
  fractionalPassengers: { ...rawFlightSearchPayload, passengers: 2.5 },
  pastDeparture: { ...rawFlightSearchPayload, departureDate: "1999-06-15" },
  sameOriginDestination: { ...rawFlightSearchPayload, origin: "JFK", destination: "JFK" },
  returnBeforeDeparture: {
    ...rawFlightSearchPayload,
    departureDate: "2099-06-22",
    returnDate: "2099-06-15",
  },
  invalidCurrency: { ...rawFlightSearchPayload, currency: "US" },
  invalidSeatClass: { ...rawFlightSearchPayload, seatClass: "ULTRA" },
};

export const invalidHotelSearch = {
  checkOutEqualsCheckIn: { ...rawHotelSearchPayload, checkInDate: "2099-07-01", checkOutDate: "2099-07-01" },
  checkOutBeforeCheckIn: { ...rawHotelSearchPayload, checkInDate: "2099-07-05", checkOutDate: "2099-07-01" },
  zeroGuests: { ...rawHotelSearchPayload, guests: 0 },
  invalidStarRating: { ...rawHotelSearchPayload, starRating: 2 },
};

export const invalidCarSearch = {
  dropOffEqualsPickup: { ...rawCarSearchPayload, pickupDate: "2099-08-01", dropoffDate: "2099-08-01" },
  dropOffBeforePickup: { ...rawCarSearchPayload, pickupDate: "2099-08-07", dropoffDate: "2099-08-01" },
  invalidCarClass: { ...rawCarSearchPayload, carClass: "LUXURY" },
};

export const invalidOffers = {
  illustrativeAndBookable: { ...rawFlightOfferPayload, provenance: "ILLUSTRATIVE", bookable: true },
  legacyProviderHotelsApi: { ...rawFlightOfferPayload, provenance: "HOTELS_API" },
  legacyProviderPriceline: { ...rawFlightOfferPayload, provenance: "PRICELINE" },
  legacyProviderAiFallback: { ...rawFlightOfferPayload, provenance: "AI_FALLBACK" },
  negativePrice: { ...rawFlightOfferPayload, price: "-100.00" },
};
