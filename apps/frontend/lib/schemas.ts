/**
 * Frontend schema adapter.
 *
 * Re-exports contracts schemas for form validation so client-side messages
 * are byte-identical to server-side messages. No field rules are redeclared.
 */

export {
  FlightSearchRequestSchema,
  HotelSearchRequestSchema,
  CarRentalSearchRequestSchema,
  SeatClassSchema,
  CarClassSchema,
  HotelStarRatingSchema,
} from "@travel/contracts/search";

export {
  RegisterRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
} from "@travel/contracts/auth";

export {
  UpdateProfileRequestSchema,
  UpdatePreferencesRequestSchema,
} from "@travel/contracts/user";

export {
  CreateBookingRequestSchema,
  CancelBookingRequestSchema,
} from "@travel/contracts/booking";

export type {
  FlightSearchRequest,
  HotelSearchRequest,
  CarRentalSearchRequest,
  SeatClass,
  CarClass,
  HotelStarRating,
  UnifiedOffer,
  OfferProvenance,
  FreshnessLabel,
  SearchResponse,
} from "@travel/contracts/search";

export type {
  RegisterRequest,
  LoginRequest,
} from "@travel/contracts/auth";

export type {
  UserProfile,
  TravelPreferences,
} from "@travel/contracts/user";

export type {
  BookingResponse,
  CreateBookingRequest,
} from "@travel/contracts/booking";
