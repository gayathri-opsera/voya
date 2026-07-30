import type { UnifiedOffer, SearchResponse } from "@travel/contracts/search";

export const bookableFlightOffer: UnifiedOffer = {
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

export const illustrativeHotelOffer: UnifiedOffer = {
  id: "offer_illustrative_hotel_01",
  provenance: "ILLUSTRATIVE",
  bookable: false,
  title: "Sample Hotel (Not Available for Booking)",
  price: "120.00",
  currency: "USD",
  details: {
    hotelName: "Example Hotel",
    address: "123 Main St, Paris",
    starRating: 4,
    roomType: "Standard",
    breakfastIncluded: true,
  },
  expiresAt: "2099-12-31T23:59:59.000Z",
  freshness: "FRESH",
};

export const mockSearchResponse: SearchResponse = {
  offers: [bookableFlightOffer, illustrativeHotelOffer],
  total: 2,
  currency: "USD",
  searchId: "search_01J9X0Y2Z3A4B5C6D7E8F9G0",
};
