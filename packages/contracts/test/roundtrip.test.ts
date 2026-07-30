import { describe, it, expect } from "vitest";
import {
  FlightSearchRequestSchema,
  HotelSearchRequestSchema,
  CarRentalSearchRequestSchema,
} from "../src/search/index.js";
import {
  rawFlightSearchPayload,
  rawHotelSearchPayload,
  rawCarSearchPayload,
} from "./fixtures/search.js";

/**
 * Round-trip test: serialize a parsed schema result to JSON, re-parse it,
 * and confirm the Date values are equivalent. This proves that ISO-8601 string
 * coercion produces equal Date objects after a JSON round-trip.
 */
describe("ISO-8601 date round-trip", () => {
  it("FlightSearchRequest dates survive JSON serialization and re-parsing", () => {
    const first = FlightSearchRequestSchema.parse(rawFlightSearchPayload);

    // Serialize to JSON (dates become ISO strings)
    const serialized = JSON.stringify(first);
    const deserialized = JSON.parse(serialized) as Record<string, unknown>;

    // Re-parse the deserialized payload
    const second = FlightSearchRequestSchema.parse(deserialized);

    expect(second.departureDate.getTime()).toBe(first.departureDate.getTime());
    if (first.returnDate && second.returnDate) {
      expect(second.returnDate.getTime()).toBe(first.returnDate.getTime());
    }
  });

  it("HotelSearchRequest dates survive JSON serialization and re-parsing", () => {
    const first = HotelSearchRequestSchema.parse(rawHotelSearchPayload);
    const serialized = JSON.stringify(first);
    const deserialized = JSON.parse(serialized) as Record<string, unknown>;
    const second = HotelSearchRequestSchema.parse(deserialized);

    expect(second.checkInDate.getTime()).toBe(first.checkInDate.getTime());
    expect(second.checkOutDate.getTime()).toBe(first.checkOutDate.getTime());
  });

  it("CarRentalSearchRequest dates survive JSON serialization and re-parsing", () => {
    const first = CarRentalSearchRequestSchema.parse(rawCarSearchPayload);
    const serialized = JSON.stringify(first);
    const deserialized = JSON.parse(serialized) as Record<string, unknown>;
    const second = CarRentalSearchRequestSchema.parse(deserialized);

    expect(second.pickupDate.getTime()).toBe(first.pickupDate.getTime());
    expect(second.dropoffDate.getTime()).toBe(first.dropoffDate.getTime());
  });
});
