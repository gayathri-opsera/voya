import { z } from "zod";
import {
  iataCode,
  futureDateString,
  isoDateString,
  currencyCode,
  positiveMoney,
  identifier,
} from "../common/primitives.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const SeatClassSchema = z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"], {
  errorMap: () => ({
    message: "Seat class must be one of: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST",
  }),
});
export type SeatClass = z.infer<typeof SeatClassSchema>;

export const CarClassSchema = z.enum(["ECONOMY", "COMPACT", "MIDSIZE", "PREMIUM", "SUV"], {
  errorMap: () => ({
    message: "Car class must be one of: ECONOMY, COMPACT, MIDSIZE, PREMIUM, SUV",
  }),
});
export type CarClass = z.infer<typeof CarClassSchema>;

export const HotelStarRatingSchema = z.union([
  z.literal(3),
  z.literal(4),
  z.literal(5),
], {
  errorMap: () => ({ message: "Star rating must be 3, 4, or 5" }),
});
export type HotelStarRating = z.infer<typeof HotelStarRatingSchema>;

export const OfferProvenanceSchema = z.enum(["AMADEUS", "RAPIDAPI", "ILLUSTRATIVE"], {
  errorMap: () => ({
    message: "Provenance must be one of: AMADEUS, RAPIDAPI, ILLUSTRATIVE",
  }),
});
export type OfferProvenance = z.infer<typeof OfferProvenanceSchema>;

export const FreshnessLabelSchema = z.enum(["FRESH", "STALE", "EXPIRED"], {
  errorMap: () => ({
    message: "Freshness label must be one of: FRESH, STALE, EXPIRED",
  }),
});
export type FreshnessLabel = z.infer<typeof FreshnessLabelSchema>;

// ─── Search Requests ──────────────────────────────────────────────────────────

export const FlightSearchRequestSchema = z
  .object({
    origin: iataCode,
    destination: iataCode,
    departureDate: futureDateString,
    returnDate: isoDateString.optional(),
    passengers: z
      .number()
      .int("Passenger count must be a whole number")
      .min(1, "At least 1 passenger is required")
      .max(9, "Maximum 9 passengers allowed"),
    seatClass: SeatClassSchema,
    currency: currencyCode,
  })
  .superRefine((data, ctx) => {
    if (data.returnDate !== undefined && data.returnDate <= data.departureDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["returnDate"],
        message: "Return date must be on or after the departure date",
      });
    }
    if (data.origin === data.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination"],
        message: "Origin and destination airports must be different",
      });
    }
  });

export type FlightSearchRequest = z.infer<typeof FlightSearchRequestSchema>;

export const HotelSearchRequestSchema = z
  .object({
    destination: z
      .string()
      .trim()
      .min(2, "Destination must be at least 2 characters")
      .max(200, "Destination must not exceed 200 characters"),
    checkInDate: futureDateString,
    checkOutDate: isoDateString,
    guests: z
      .number()
      .int("Guest count must be a whole number")
      .min(1, "At least 1 guest is required")
      .max(20, "Maximum 20 guests allowed"),
    starRating: HotelStarRatingSchema.optional(),
    currency: currencyCode,
  })
  .superRefine((data, ctx) => {
    if (data.checkOutDate <= data.checkInDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkOutDate"],
        message: "Check-out date must be strictly after the check-in date",
      });
    }
  });

export type HotelSearchRequest = z.infer<typeof HotelSearchRequestSchema>;

export const CarRentalSearchRequestSchema = z
  .object({
    pickupLocation: z
      .string()
      .trim()
      .min(2, "Pickup location must be at least 2 characters")
      .max(200, "Pickup location must not exceed 200 characters"),
    dropoffLocation: z
      .string()
      .trim()
      .min(2, "Dropoff location must be at least 2 characters")
      .max(200, "Dropoff location must not exceed 200 characters"),
    pickupDate: futureDateString,
    dropoffDate: isoDateString,
    carClass: CarClassSchema,
    currency: currencyCode,
  })
  .superRefine((data, ctx) => {
    if (data.dropoffDate <= data.pickupDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dropoffDate"],
        message: "Drop-off date must be strictly after the pick-up date",
      });
    }
  });

export type CarRentalSearchRequest = z.infer<typeof CarRentalSearchRequestSchema>;

// ─── Supplier-Specific Details ────────────────────────────────────────────────

export const FlightOfferDetailsSchema = z.object({
  airline: z.string().optional(),
  flightNumber: z.string().optional(),
  departureAirport: iataCode,
  arrivalAirport: iataCode,
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  duration: z.string().optional(),
  stops: z.number().int().min(0).optional(),
  seatClass: SeatClassSchema,
});
export type FlightOfferDetails = z.infer<typeof FlightOfferDetailsSchema>;

export const HotelOfferDetailsSchema = z.object({
  hotelName: z.string().optional(),
  address: z.string().optional(),
  starRating: HotelStarRatingSchema.optional(),
  amenities: z.array(z.string()).optional(),
  roomType: z.string().optional(),
  breakfastIncluded: z.boolean().optional(),
});
export type HotelOfferDetails = z.infer<typeof HotelOfferDetailsSchema>;

export const CarOfferDetailsSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  carClass: CarClassSchema,
  seats: z.number().int().min(1).optional(),
  transmission: z.enum(["AUTOMATIC", "MANUAL"]).optional(),
  unlimitedMileage: z.boolean().optional(),
});
export type CarOfferDetails = z.infer<typeof CarOfferDetailsSchema>;

export const OfferDetailsSchema = z.union([
  FlightOfferDetailsSchema,
  HotelOfferDetailsSchema,
  CarOfferDetailsSchema,
]);
export type OfferDetails = z.infer<typeof OfferDetailsSchema>;

// ─── Unified Offer ────────────────────────────────────────────────────────────

export const UnifiedOfferSchema = z
  .object({
    id: identifier,
    provenance: OfferProvenanceSchema,
    bookable: z.boolean(),
    title: z.string().min(1),
    price: positiveMoney,
    currency: currencyCode,
    rating: z.number().min(0).max(5).optional(),
    reviews: z.number().int().min(0).optional(),
    details: OfferDetailsSchema,
    expiresAt: z.string().datetime({ message: "expiresAt must be a valid ISO-8601 datetime" }),
    freshness: FreshnessLabelSchema,
  })
  .superRefine((offer, ctx) => {
    // ILLUSTRATIVE offers must never be bookable — structural constraint
    if (offer.provenance === "ILLUSTRATIVE" && offer.bookable === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bookable"],
        message:
          "Illustrative offers cannot be bookable — set bookable to false for ILLUSTRATIVE provenance",
      });
    }
  });

export type UnifiedOffer = z.infer<typeof UnifiedOfferSchema>;

// ─── Search Responses ─────────────────────────────────────────────────────────

export const SearchResponseSchema = z.object({
  offers: z.array(UnifiedOfferSchema),
  total: z.number().int().min(0),
  currency: currencyCode,
  searchId: identifier,
  cachedAt: z.string().datetime().optional(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
