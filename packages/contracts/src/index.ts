/**
 * @travel/contracts
 *
 * Single authoritative source of Zod schemas and TypeScript types for the
 * Voya travel platform. All services and the web app resolve types from this
 * package via the pnpm workspace protocol.
 *
 * Domain modules:
 *   - search   : FlightSearchRequest, HotelSearchRequest, CarRentalSearchRequest, UnifiedOffer
 *   - booking  : CreateBookingRequest, BookingResponse, Itinerary, audit entries
 *   - payment  : PaymentIntentRequest/Response, RefundRequest/Response
 *   - auth     : RegisterRequest, LoginRequest, RefreshRequest, ActorContext, roles
 *   - user     : UserProfile, TravelPreferences, update requests
 *   - events   : BookingConfirmationEvent, BookingCancellationEvent, NotificationEvent
 *
 * Usage:
 *   import { FlightSearchRequestSchema } from "@travel/contracts/search";
 *   import type { FlightSearchRequest }   from "@travel/contracts/search";
 *
 * Types are always derived with z.infer — never hand-written.
 */

// ─── Errors ───────────────────────────────────────────────────────────────────
export {
  ErrorCode,
  HTTP_STATUS_MAP,
  resolveHttpStatus,
  ErrorDetailSchema,
  ErrorEnvelopeSchema,
  AppError,
  validationFailed,
  unauthenticated,
  forbidden,
  notFound,
  conflict,
  lifecycleConflict,
  duplicateEmail,
  supplierRejected,
  rateLimited,
  supplierUnavailable,
  supplierTimeout,
  internalError,
  RESTRICTED_FIELDS,
  serialiseError,
} from "./errors/index.js";
export type {
  AllowedHttpStatus,
  ErrorDetail,
  ErrorEnvelope,
  SerialiseResult,
} from "./errors/index.js";

// ─── Common primitives ────────────────────────────────────────────────────────
export {
  iataCode,
  isoDateString,
  isoDateTimeString,
  futureDateString,
  currencyCode,
  positiveMoney,
  identifier,
  correlationId,
  paginationCursor,
} from "./common/primitives.js";

// ─── Search ───────────────────────────────────────────────────────────────────
export {
  SeatClassSchema,
  CarClassSchema,
  HotelStarRatingSchema,
  OfferProvenanceSchema,
  FreshnessLabelSchema,
  FlightSearchRequestSchema,
  HotelSearchRequestSchema,
  CarRentalSearchRequestSchema,
  FlightOfferDetailsSchema,
  HotelOfferDetailsSchema,
  CarOfferDetailsSchema,
  OfferDetailsSchema,
  UnifiedOfferSchema,
  SearchResponseSchema,
} from "./search/index.js";
export type {
  SeatClass,
  CarClass,
  HotelStarRating,
  OfferProvenance,
  FreshnessLabel,
  FlightSearchRequest,
  HotelSearchRequest,
  CarRentalSearchRequest,
  FlightOfferDetails,
  HotelOfferDetails,
  CarOfferDetails,
  OfferDetails,
  UnifiedOffer,
  SearchResponse,
} from "./search/index.js";

// ─── Booking ──────────────────────────────────────────────────────────────────
export {
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
export type {
  BookingType,
  BookingStatus,
  BookingAuditAction,
  PassengerInfo,
  CreateBookingRequest,
  BookingResponse,
  ItineraryItem,
  Itinerary,
  BookingAuditEntry,
  UpdateBookingRequest,
  CancelBookingRequest,
} from "./booking/index.js";

// ─── Payment ──────────────────────────────────────────────────────────────────
export {
  PaymentStatusSchema,
  PaymentMethodTypeSchema,
  PaymentIntentRequestSchema,
  PaymentIntentResponseSchema,
  PaymentRecordSchema,
  RefundRequestSchema,
  RefundResponseSchema,
} from "./payment/index.js";
export type {
  PaymentStatus,
  PaymentMethodType,
  PaymentIntentRequest,
  PaymentIntentResponse,
  PaymentRecord,
  RefundRequest,
  RefundResponse,
} from "./payment/index.js";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export {
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
export type {
  UserRole,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  LogoutRequest,
  OAuthCallback,
  EmailVerificationRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  ActorContext,
} from "./auth/index.js";

// ─── User ─────────────────────────────────────────────────────────────────────
export {
  TravelPreferencesSchema,
  UserProfileSchema,
  UpdateProfileRequestSchema,
  UpdatePreferencesRequestSchema,
} from "./user/index.js";
export type {
  TravelPreferences,
  UserProfile,
  UpdateProfileRequest,
  UpdatePreferencesRequest,
} from "./user/index.js";

// ─── Events ───────────────────────────────────────────────────────────────────
export {
  NotificationChannelSchema,
  BookingConfirmationEventSchema,
  BookingCancellationEventSchema,
  NotificationEventSchema,
  PaymentEventSchema,
  BookingStatusChangedEventSchema,
} from "./events/index.js";
export type {
  NotificationChannel,
  BookingConfirmationEvent,
  BookingCancellationEvent,
  NotificationEvent,
  PaymentEvent,
  BookingStatusChangedEvent,
} from "./events/index.js";
