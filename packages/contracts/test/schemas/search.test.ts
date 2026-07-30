import { describe, it, expect } from "vitest";
import {
  FlightSearchRequestSchema,
  HotelSearchRequestSchema,
  CarRentalSearchRequestSchema,
  UnifiedOfferSchema,
} from "../../src/search/index.js";
import {
  rawFlightSearchPayload,
  rawHotelSearchPayload,
  rawCarSearchPayload,
  rawFlightOfferPayload,
  rawIllustrativeOfferPayload,
  invalidFlightSearch,
  invalidHotelSearch,
  invalidCarSearch,
  invalidOffers,
} from "../fixtures/search.js";

describe("FlightSearchRequestSchema", () => {
  it("parses a valid flight search payload", () => {
    const result = FlightSearchRequestSchema.safeParse(rawFlightSearchPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe("JFK");
      expect(result.data.destination).toBe("LHR");
      expect(result.data.departureDate).toBeInstanceOf(Date);
      expect(result.data.returnDate).toBeInstanceOf(Date);
      expect(result.data.passengers).toBe(2);
      expect(result.data.seatClass).toBe("ECONOMY");
    }
  });

  it("normalises lowercase airport codes to uppercase", () => {
    const result = FlightSearchRequestSchema.safeParse({
      ...rawFlightSearchPayload,
      origin: "jfk",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe("JFK");
    }
  });

  it("rejects a 4-letter airport code with the BR-11 message", () => {
    const result = FlightSearchRequestSchema.safeParse(invalidFlightSearch.fourLetterAirport);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("origin"));
      expect(issue?.message).toMatch(/3-letter IATA code/i);
    }
  });

  it("rejects 0 passengers with a clear minimum message", () => {
    const result = FlightSearchRequestSchema.safeParse(invalidFlightSearch.zeroPassengers);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("passengers"));
      expect(issue?.message).toMatch(/at least 1 passenger/i);
    }
  });

  it("rejects 10 passengers with the maximum exceeded message", () => {
    const result = FlightSearchRequestSchema.safeParse(invalidFlightSearch.tenPassengers);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("passengers"));
      expect(issue?.message).toMatch(/maximum 9/i);
    }
  });

  it("rejects fractional passenger count", () => {
    const result = FlightSearchRequestSchema.safeParse(invalidFlightSearch.fractionalPassengers);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("passengers"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects a past departure date", () => {
    const result = FlightSearchRequestSchema.safeParse(invalidFlightSearch.pastDeparture);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("departureDate"));
      expect(issue?.message).toMatch(/future/i);
    }
  });

  it("rejects when origin equals destination", () => {
    const result = FlightSearchRequestSchema.safeParse(
      invalidFlightSearch.sameOriginDestination,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("destination"));
      expect(issue?.message).toMatch(/different/i);
    }
  });

  it("rejects return date before departure date", () => {
    const result = FlightSearchRequestSchema.safeParse(
      invalidFlightSearch.returnBeforeDeparture,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("returnDate"));
      expect(issue?.message).toMatch(/on or after/i);
    }
  });

  it("accepts a one-way search without returnDate", () => {
    const { returnDate: _skip, ...oneWay } = rawFlightSearchPayload;
    const result = FlightSearchRequestSchema.safeParse(oneWay);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.returnDate).toBeUndefined();
    }
  });

  it("rejects an invalid currency code (2 letters)", () => {
    const result = FlightSearchRequestSchema.safeParse(invalidFlightSearch.invalidCurrency);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("currency"));
      expect(issue?.message).toMatch(/3-letter/i);
    }
  });
});

describe("HotelSearchRequestSchema", () => {
  it("parses a valid hotel search payload", () => {
    const result = HotelSearchRequestSchema.safeParse(rawHotelSearchPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.destination).toBe("Paris, France");
      expect(result.data.checkInDate).toBeInstanceOf(Date);
      expect(result.data.checkOutDate).toBeInstanceOf(Date);
      expect(result.data.guests).toBe(2);
      expect(result.data.starRating).toBe(4);
    }
  });

  it("rejects when check-out equals check-in (same-day stay)", () => {
    const result = HotelSearchRequestSchema.safeParse(
      invalidHotelSearch.checkOutEqualsCheckIn,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("checkOutDate"));
      expect(issue?.message).toMatch(/strictly after/i);
    }
  });

  it("rejects when check-out is before check-in", () => {
    const result = HotelSearchRequestSchema.safeParse(
      invalidHotelSearch.checkOutBeforeCheckIn,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("checkOutDate"));
      expect(issue?.message).toMatch(/strictly after/i);
    }
  });

  it("rejects zero guests", () => {
    const result = HotelSearchRequestSchema.safeParse(invalidHotelSearch.zeroGuests);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("guests"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects star rating of 2 (not 3, 4, or 5)", () => {
    const result = HotelSearchRequestSchema.safeParse(invalidHotelSearch.invalidStarRating);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("starRating"));
      expect(issue).toBeDefined();
    }
  });

  it("accepts a search without optional star rating", () => {
    const { starRating: _skip, ...noStars } = rawHotelSearchPayload;
    const result = HotelSearchRequestSchema.safeParse(noStars);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.starRating).toBeUndefined();
    }
  });
});

describe("CarRentalSearchRequestSchema", () => {
  it("parses a valid car search payload", () => {
    const result = CarRentalSearchRequestSchema.safeParse(rawCarSearchPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.carClass).toBe("MIDSIZE");
      expect(result.data.pickupDate).toBeInstanceOf(Date);
      expect(result.data.dropoffDate).toBeInstanceOf(Date);
    }
  });

  it("rejects when drop-off equals pick-up", () => {
    const result = CarRentalSearchRequestSchema.safeParse(
      invalidCarSearch.dropOffEqualsPickup,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("dropoffDate"));
      expect(issue?.message).toMatch(/strictly after/i);
    }
  });

  it("rejects when drop-off is before pick-up", () => {
    const result = CarRentalSearchRequestSchema.safeParse(
      invalidCarSearch.dropOffBeforePickup,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("dropoffDate"));
      expect(issue?.message).toMatch(/strictly after/i);
    }
  });

  it("rejects an invalid car class", () => {
    const result = CarRentalSearchRequestSchema.safeParse(invalidCarSearch.invalidCarClass);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("carClass"));
      expect(issue).toBeDefined();
    }
  });
});

describe("UnifiedOfferSchema", () => {
  it("parses a valid AMADEUS bookable offer", () => {
    const result = UnifiedOfferSchema.safeParse(rawFlightOfferPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provenance).toBe("AMADEUS");
      expect(result.data.bookable).toBe(true);
    }
  });

  it("parses a valid ILLUSTRATIVE non-bookable offer", () => {
    const result = UnifiedOfferSchema.safeParse(rawIllustrativeOfferPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provenance).toBe("ILLUSTRATIVE");
      expect(result.data.bookable).toBe(false);
    }
  });

  it("rejects ILLUSTRATIVE offer with bookable=true (structural constraint)", () => {
    const result = UnifiedOfferSchema.safeParse(invalidOffers.illustrativeAndBookable);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("bookable"));
      expect(issue?.message).toMatch(/illustrative/i);
    }
  });

  it("rejects legacy HOTELS_API provenance", () => {
    const result = UnifiedOfferSchema.safeParse(invalidOffers.legacyProviderHotelsApi);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("provenance"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects legacy PRICELINE provenance", () => {
    const result = UnifiedOfferSchema.safeParse(invalidOffers.legacyProviderPriceline);
    expect(result.success).toBe(false);
  });

  it("rejects legacy AI_FALLBACK provenance", () => {
    const result = UnifiedOfferSchema.safeParse(invalidOffers.legacyProviderAiFallback);
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = UnifiedOfferSchema.safeParse(invalidOffers.negativePrice);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("price"));
      expect(issue).toBeDefined();
    }
  });
});
