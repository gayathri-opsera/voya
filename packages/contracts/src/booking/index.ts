import { z } from "zod";
import { identifier, isoDateString, positiveMoney, currencyCode } from "../common/primitives.js";
import { UnifiedOfferSchema } from "../search/index.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const BookingTypeSchema = z.enum(["FLIGHT", "HOTEL", "CAR"], {
  errorMap: () => ({ message: "Booking type must be one of: FLIGHT, HOTEL, CAR" }),
});
export type BookingType = z.infer<typeof BookingTypeSchema>;

export const BookingStatusSchema = z.enum(
  ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"],
  {
    errorMap: () => ({
      message: "Booking status must be one of: PENDING, CONFIRMED, CANCELLED, EXPIRED",
    }),
  },
);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingAuditActionSchema = z.enum(
  ["CREATED", "CONFIRMED", "CANCELLED", "EXPIRED", "REFUNDED", "MODIFIED"],
  {
    errorMap: () => ({
      message:
        "Audit action must be one of: CREATED, CONFIRMED, CANCELLED, EXPIRED, REFUNDED, MODIFIED",
    }),
  },
);
export type BookingAuditAction = z.infer<typeof BookingAuditActionSchema>;

// ─── Passenger Info ───────────────────────────────────────────────────────────

export const PassengerInfoSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  dateOfBirth: isoDateString,
  passportNumber: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{6,20}$/, "Passport number must be 6-20 alphanumeric characters")
    .optional(),
  nationality: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, "Nationality must be a 2-letter ISO-3166-1 country code")
    .optional(),
  specialRequests: z.string().trim().max(500).optional(),
});
export type PassengerInfo = z.infer<typeof PassengerInfoSchema>;

// ─── Create Booking Request ───────────────────────────────────────────────────

export const CreateBookingRequestSchema = z.object({
  offerId: identifier,
  bookingType: BookingTypeSchema,
  passengers: z
    .array(PassengerInfoSchema)
    .min(1, "At least one passenger is required")
    .max(9, "Maximum 9 passengers allowed"),
  contactEmail: z.string().email("A valid contact email is required"),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, "Contact phone must be a valid phone number")
    .optional(),
  currency: currencyCode,
  idempotencyKey: identifier,
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

// ─── Booking Response ─────────────────────────────────────────────────────────

export const BookingResponseSchema = z.object({
  bookingId: identifier,
  bookingReference: z.string().min(1),
  status: BookingStatusSchema,
  bookingType: BookingTypeSchema,
  offer: UnifiedOfferSchema,
  passengers: z.array(PassengerInfoSchema),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  totalAmount: positiveMoney,
  currency: currencyCode,
  expiresAt: z.string().datetime().optional(),
  confirmedAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BookingResponse = z.infer<typeof BookingResponseSchema>;

// ─── Itinerary ────────────────────────────────────────────────────────────────

export const ItineraryItemSchema = z.object({
  itemId: identifier,
  bookingId: identifier,
  bookingType: BookingTypeSchema,
  status: BookingStatusSchema,
  offer: UnifiedOfferSchema,
  totalAmount: positiveMoney,
  currency: currencyCode,
  createdAt: z.string().datetime(),
});
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

export const ItinerarySchema = z.object({
  itineraryId: identifier,
  userId: identifier,
  title: z.string().trim().min(1).max(200),
  items: z.array(ItineraryItemSchema),
  totalAmount: positiveMoney,
  currency: currencyCode,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;

// ─── Booking Audit Log ────────────────────────────────────────────────────────

export const BookingAuditEntrySchema = z.object({
  auditId: identifier,
  bookingId: identifier,
  action: BookingAuditActionSchema,
  actorId: identifier,
  actorRole: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  correlationId: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type BookingAuditEntry = z.infer<typeof BookingAuditEntrySchema>;

// ─── Booking Lifecycle ────────────────────────────────────────────────────────

export const UpdateBookingRequestSchema = z.object({
  passengers: z.array(PassengerInfoSchema).min(1).max(9).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  specialRequests: z.string().max(500).optional(),
});
export type UpdateBookingRequest = z.infer<typeof UpdateBookingRequestSchema>;

export const CancelBookingRequestSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
});
export type CancelBookingRequest = z.infer<typeof CancelBookingRequestSchema>;
