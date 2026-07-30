import { z } from "zod";
import { identifier } from "../common/primitives.js";

// ─── User Roles ───────────────────────────────────────────────────────────────

export const UserRoleSchema = z.enum(["traveler", "support_agent", "system"], {
  errorMap: () => ({
    message: "Role must be one of: traveler, support_agent, system",
  }),
});
export type UserRole = z.infer<typeof UserRoleSchema>;

// ─── Register ─────────────────────────────────────────────────────────────────

export const RegisterRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid email address is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseSchema = z.object({
  userId: identifier,
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: UserRoleSchema,
  verificationEmailSent: z.boolean(),
  createdAt: z.string().datetime(),
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

// ─── Login ────────────────────────────────────────────────────────────────────

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email address is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
  userId: identifier,
  role: UserRoleSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// ─── Refresh ──────────────────────────────────────────────────────────────────

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const RefreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
});
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

// ─── Logout ───────────────────────────────────────────────────────────────────

export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

// ─── OAuth Callback ───────────────────────────────────────────────────────────

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1, "OAuth code is required"),
  state: z.string().min(1, "OAuth state parameter is required"),
  provider: z.enum(["google", "apple"], {
    errorMap: () => ({ message: "OAuth provider must be one of: google, apple" }),
  }),
  redirectUri: z.string().url("A valid redirect URI is required"),
});
export type OAuthCallback = z.infer<typeof OAuthCallbackSchema>;

// ─── Email Verification ───────────────────────────────────────────────────────

export const EmailVerificationRequestSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});
export type EmailVerificationRequest = z.infer<typeof EmailVerificationRequestSchema>;

// ─── Password Reset ───────────────────────────────────────────────────────────

export const PasswordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email address is required"),
});
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must not exceed 128 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

// ─── Actor Context (JWT payload shape shared across services) ─────────────────

export const ActorContextSchema = z.object({
  userId: identifier,
  role: UserRoleSchema,
  sessionId: identifier,
  email: z.string().email(),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type ActorContext = z.infer<typeof ActorContextSchema>;
