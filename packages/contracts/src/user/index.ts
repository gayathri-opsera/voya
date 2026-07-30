import { z } from "zod";
import { identifier, isoDateString } from "../common/primitives.js";
import { UserRoleSchema } from "../auth/index.js";
import { SeatClassSchema, CarClassSchema, HotelStarRatingSchema } from "../search/index.js";

// ─── Travel Preferences ───────────────────────────────────────────────────────

export const TravelPreferencesSchema = z.object({
  preferredSeatClass: SeatClassSchema.optional(),
  preferredCarClass: CarClassSchema.optional(),
  preferredHotelStarRating: HotelStarRatingSchema.optional(),
  preferredCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO-4217 code")
    .optional(),
  dietaryRequirements: z.array(z.string().trim().max(100)).max(10).optional(),
  accessibilityNeeds: z.array(z.string().trim().max(200)).max(10).optional(),
  loyaltyPrograms: z
    .array(
      z.object({
        program: z.string().trim().max(100),
        memberId: z.string().trim().max(100),
      }),
    )
    .max(20)
    .optional(),
  newsletterOptIn: z.boolean().default(false),
});
export type TravelPreferences = z.infer<typeof TravelPreferencesSchema>;

// ─── User Profile ─────────────────────────────────────────────────────────────

export const UserProfileSchema = z.object({
  userId: identifier,
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: UserRoleSchema,
  avatarUrl: z.string().url().optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, "Phone number must be a valid format")
    .optional(),
  dateOfBirth: isoDateString.optional(),
  nationality: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, "Nationality must be a 2-letter ISO country code")
    .optional(),
  passportNumber: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{6,20}$/, "Passport number must be 6-20 alphanumeric characters")
    .optional(),
  passportExpiryDate: isoDateString.optional(),
  preferences: TravelPreferencesSchema.optional(),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ─── Update Profile Request ───────────────────────────────────────────────────

export const UpdateProfileRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, "Phone number must be a valid format")
    .optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  nationality: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, "Nationality must be a 2-letter ISO country code")
    .optional(),
  passportNumber: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{6,20}$/, "Passport number must be 6-20 alphanumeric characters")
    .optional(),
  passportExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const UpdatePreferencesRequestSchema = TravelPreferencesSchema.partial();
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;
