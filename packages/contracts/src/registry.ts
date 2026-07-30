/**
 * Schema Registry — every exported schema with a stable identifier.
 *
 * Adding a schema to @travel/contracts without adding it here fails a
 * completeness test, preventing silent gaps in the baseline set.
 *
 * @testRunner Vitest (assumption pending tech-lead ratification — see README.md)
 */

import { type ZodTypeAny } from "zod";

// ─── Domain imports ────────────────────────────────────────────────────────────
import {
  FlightSearchRequestSchema,
  HotelSearchRequestSchema,
  CarRentalSearchRequestSchema,
  UnifiedOfferSchema,
  SearchResponseSchema,
  SeatClassSchema,
  CarClassSchema,
  HotelStarRatingSchema,
  OfferProvenanceSchema,
  FreshnessLabelSchema,
} from "./search/index.js";

import {
  BookingTypeSchema,
  BookingStatusSchema,
  BookingAuditActionSchema,
  PassengerInfoSchema,
  CreateBookingRequestSchema,
  BookingResponseSchema,
  ItineraryItemSchema,
  ItinerarySchema,
  BookingAuditEntrySchema,
  UpdateBookingRequestSchema,
  CancelBookingRequestSchema,
} from "./booking/index.js";

import {
  PaymentStatusSchema,
  PaymentMethodTypeSchema,
  PaymentIntentRequestSchema,
  PaymentIntentResponseSchema,
  PaymentRecordSchema,
  RefundRequestSchema,
  RefundResponseSchema,
} from "./payment/index.js";

import {
  UserRoleSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  RefreshRequestSchema,
  RefreshResponseSchema,
  LogoutRequestSchema,
  OAuthCallbackSchema,
  EmailVerificationRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  ActorContextSchema,
} from "./auth/index.js";

import {
  TravelPreferencesSchema,
  UserProfileSchema,
  UpdateProfileRequestSchema,
  UpdatePreferencesRequestSchema,
} from "./user/index.js";

import {
  BookingConfirmationEventSchema,
  BookingCancellationEventSchema,
  NotificationEventSchema,
  PaymentEventSchema,
  BookingStatusChangedEventSchema,
  NotificationChannelSchema,
} from "./events/index.js";

import {
  ErrorDetailSchema,
  ErrorEnvelopeSchema,
} from "./errors/envelope.js";

// ─── Registry entry ────────────────────────────────────────────────────────────

export interface SchemaEntry {
  id: string;
  schema: ZodTypeAny;
  domain: string;
  /** Whether this schema is used as a request shape (affects breaking-change classification) */
  isRequestSchema: boolean;
}

/**
 * Canonical registry of every exported schema.
 * Schema IDs are stable identifiers used as baseline filenames.
 * Changing an ID is treated as a removal + addition and is a breaking change.
 */
export const SCHEMA_REGISTRY: Readonly<SchemaEntry[]> = [
  // ─── Search ──────────────────────────────────────────────────────────────────
  { id: "search.FlightSearchRequest",        schema: FlightSearchRequestSchema,    domain: "search", isRequestSchema: true },
  { id: "search.HotelSearchRequest",         schema: HotelSearchRequestSchema,     domain: "search", isRequestSchema: true },
  { id: "search.CarRentalSearchRequest",     schema: CarRentalSearchRequestSchema, domain: "search", isRequestSchema: true },
  { id: "search.UnifiedOffer",               schema: UnifiedOfferSchema,           domain: "search", isRequestSchema: false },
  { id: "search.SearchResponse",             schema: SearchResponseSchema,         domain: "search", isRequestSchema: false },
  { id: "search.SeatClass",                  schema: SeatClassSchema,              domain: "search", isRequestSchema: false },
  { id: "search.CarClass",                   schema: CarClassSchema,               domain: "search", isRequestSchema: false },
  { id: "search.HotelStarRating",            schema: HotelStarRatingSchema,        domain: "search", isRequestSchema: false },
  { id: "search.OfferProvenance",            schema: OfferProvenanceSchema,        domain: "search", isRequestSchema: false },
  { id: "search.FreshnessLabel",             schema: FreshnessLabelSchema,         domain: "search", isRequestSchema: false },

  // ─── Booking ─────────────────────────────────────────────────────────────────
  { id: "booking.BookingType",               schema: BookingTypeSchema,            domain: "booking", isRequestSchema: false },
  { id: "booking.BookingStatus",             schema: BookingStatusSchema,          domain: "booking", isRequestSchema: false },
  { id: "booking.BookingAuditAction",        schema: BookingAuditActionSchema,     domain: "booking", isRequestSchema: false },
  { id: "booking.PassengerInfo",             schema: PassengerInfoSchema,          domain: "booking", isRequestSchema: true },
  { id: "booking.CreateBookingRequest",      schema: CreateBookingRequestSchema,   domain: "booking", isRequestSchema: true },
  { id: "booking.BookingResponse",           schema: BookingResponseSchema,        domain: "booking", isRequestSchema: false },
  { id: "booking.ItineraryItem",             schema: ItineraryItemSchema,          domain: "booking", isRequestSchema: false },
  { id: "booking.Itinerary",                 schema: ItinerarySchema,              domain: "booking", isRequestSchema: false },
  { id: "booking.BookingAuditEntry",         schema: BookingAuditEntrySchema,      domain: "booking", isRequestSchema: false },
  { id: "booking.UpdateBookingRequest",      schema: UpdateBookingRequestSchema,   domain: "booking", isRequestSchema: true },
  { id: "booking.CancelBookingRequest",      schema: CancelBookingRequestSchema,   domain: "booking", isRequestSchema: true },

  // ─── Payment ─────────────────────────────────────────────────────────────────
  { id: "payment.PaymentStatus",             schema: PaymentStatusSchema,          domain: "payment", isRequestSchema: false },
  { id: "payment.PaymentMethodType",         schema: PaymentMethodTypeSchema,      domain: "payment", isRequestSchema: false },
  { id: "payment.PaymentIntentRequest",      schema: PaymentIntentRequestSchema,   domain: "payment", isRequestSchema: true },
  { id: "payment.PaymentIntentResponse",     schema: PaymentIntentResponseSchema,  domain: "payment", isRequestSchema: false },
  { id: "payment.PaymentRecord",             schema: PaymentRecordSchema,          domain: "payment", isRequestSchema: false },
  { id: "payment.RefundRequest",             schema: RefundRequestSchema,          domain: "payment", isRequestSchema: true },
  { id: "payment.RefundResponse",            schema: RefundResponseSchema,         domain: "payment", isRequestSchema: false },

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  { id: "auth.UserRole",                     schema: UserRoleSchema,               domain: "auth", isRequestSchema: false },
  { id: "auth.RegisterRequest",              schema: RegisterRequestSchema,        domain: "auth", isRequestSchema: true },
  { id: "auth.RegisterResponse",             schema: RegisterResponseSchema,       domain: "auth", isRequestSchema: false },
  { id: "auth.LoginRequest",                 schema: LoginRequestSchema,           domain: "auth", isRequestSchema: true },
  { id: "auth.LoginResponse",                schema: LoginResponseSchema,          domain: "auth", isRequestSchema: false },
  { id: "auth.RefreshRequest",               schema: RefreshRequestSchema,         domain: "auth", isRequestSchema: true },
  { id: "auth.RefreshResponse",              schema: RefreshResponseSchema,        domain: "auth", isRequestSchema: false },
  { id: "auth.LogoutRequest",                schema: LogoutRequestSchema,          domain: "auth", isRequestSchema: true },
  { id: "auth.OAuthCallback",                schema: OAuthCallbackSchema,          domain: "auth", isRequestSchema: true },
  { id: "auth.EmailVerificationRequest",     schema: EmailVerificationRequestSchema, domain: "auth", isRequestSchema: true },
  { id: "auth.PasswordResetRequest",         schema: PasswordResetRequestSchema,   domain: "auth", isRequestSchema: true },
  { id: "auth.PasswordResetConfirm",         schema: PasswordResetConfirmSchema,   domain: "auth", isRequestSchema: true },
  { id: "auth.ActorContext",                 schema: ActorContextSchema,           domain: "auth", isRequestSchema: false },

  // ─── User ─────────────────────────────────────────────────────────────────────
  { id: "user.TravelPreferences",            schema: TravelPreferencesSchema,      domain: "user", isRequestSchema: false },
  { id: "user.UserProfile",                  schema: UserProfileSchema,            domain: "user", isRequestSchema: false },
  { id: "user.UpdateProfileRequest",         schema: UpdateProfileRequestSchema,   domain: "user", isRequestSchema: true },
  { id: "user.UpdatePreferencesRequest",     schema: UpdatePreferencesRequestSchema, domain: "user", isRequestSchema: true },

  // ─── Events ───────────────────────────────────────────────────────────────────
  { id: "events.NotificationChannel",        schema: NotificationChannelSchema,    domain: "events", isRequestSchema: false },
  { id: "events.BookingConfirmationEvent",   schema: BookingConfirmationEventSchema, domain: "events", isRequestSchema: false },
  { id: "events.BookingCancellationEvent",   schema: BookingCancellationEventSchema, domain: "events", isRequestSchema: false },
  { id: "events.NotificationEvent",          schema: NotificationEventSchema,      domain: "events", isRequestSchema: false },
  { id: "events.PaymentEvent",               schema: PaymentEventSchema,           domain: "events", isRequestSchema: false },
  { id: "events.BookingStatusChangedEvent",  schema: BookingStatusChangedEventSchema, domain: "events", isRequestSchema: false },

  // ─── Errors ───────────────────────────────────────────────────────────────────
  { id: "errors.ErrorDetail",                schema: ErrorDetailSchema,            domain: "errors", isRequestSchema: false },
  { id: "errors.ErrorEnvelope",              schema: ErrorEnvelopeSchema,          domain: "errors", isRequestSchema: false },
] as const;

/** Look up a schema entry by stable ID */
export function getSchemaById(id: string): SchemaEntry | undefined {
  return SCHEMA_REGISTRY.find((e) => e.id === id);
}

/** All schema IDs in the registry */
export const REGISTRY_IDS = SCHEMA_REGISTRY.map((e) => e.id);
