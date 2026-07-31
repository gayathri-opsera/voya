/**
 * @voya/contracts — Authentication schemas
 *
 * Zod schemas for Bonvoy OIDC Authorization Code with PKCE request/response
 * shapes. InternalPrincipalSchema uses .strict() to prevent undeclared fields
 * from leaking into issued tokens. BonvoyClaimsSchema does NOT use .strict()
 * because upstream OIDC tokens may carry extra fields that are intentionally
 * dropped after parsing.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// BonvoyMemberTier — safe-to-expose tier value, conveys no PII
// ---------------------------------------------------------------------------

export const BonvoyMemberTierEnum = z.enum([
  'MEMBER',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'TITANIUM',
  'AMBASSADOR',
]);
export type BonvoyMemberTier = z.infer<typeof BonvoyMemberTierEnum>;
export const BonvoyMemberTier = BonvoyMemberTierEnum.enum;

// ---------------------------------------------------------------------------
// AuthErrorCode — stable machine-readable error identifiers
// ---------------------------------------------------------------------------

export const AuthErrorCodeEnum = z.enum([
  'AUTH_STATE_INVALID',
  'AUTH_NONCE_INVALID',
  'AUTH_CODE_VERIFIER_MISSING',
  'AUTH_WRONG_ISSUER',
  'AUTH_WRONG_AUDIENCE',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_SIGNATURE_INVALID',
  'AUTH_TIER_MISSING',
  'AUTH_REPLAY_DETECTED',
  'AUTH_PROVIDER_UNAVAILABLE',
  'AUTH_ACCOUNT_DISABLED',
  'AUTH_MALFORMED_REQUEST',
]);
export type AuthErrorCode = z.infer<typeof AuthErrorCodeEnum>;
export const AuthErrorCode = AuthErrorCodeEnum.enum;

// ---------------------------------------------------------------------------
// AuthStartRequest — GET /v1/auth/bonvoy/start query params
// ---------------------------------------------------------------------------

export const AuthStartRequestSchema = z
  .object({
    returnTo: z
      .string()
      .max(200)
      .regex(/^\//, 'returnTo must be a relative path starting with /')
      .optional(),
  })
  .strict();

export type AuthStartRequest = z.infer<typeof AuthStartRequestSchema>;

// ---------------------------------------------------------------------------
// AuthCallbackRequest — POST /v1/auth/bonvoy/callback request body
// ---------------------------------------------------------------------------

export const AuthCallbackRequestSchema = z
  .object({
    code:     z.string().min(1, 'authorization code must not be empty'),
    state:    z.string().min(1, 'state parameter must not be empty'),
    returnTo: z
      .string()
      .max(200)
      .regex(/^\//, 'returnTo must be a relative path starting with /')
      .optional(),
  })
  .strict();

export type AuthCallbackRequest = z.infer<typeof AuthCallbackRequestSchema>;

// ---------------------------------------------------------------------------
// BonvoyClaims — upstream OIDC ID token payload
//
// Only the fields Voya needs to inspect are declared here. Extra upstream
// fields (given_name, email, phone, etc.) are intentionally omitted and will
// be stripped by TypeScript's structural typing. Do NOT add personal data
// fields — they must not be parsed into application memory or logged.
// ---------------------------------------------------------------------------

export const BonvoyClaimsSchema = z.object({
  sub:           z.string().min(1),
  iss:           z.string().url(),
  aud:           z.union([z.string().min(1), z.array(z.string().min(1))]),
  exp:           z.number().int().positive(),
  iat:           z.number().int().positive(),
  nonce:         z.string().min(1),
  verified_tier: z.string().optional(),
});
// No .strict() — upstream tokens may carry extra claims that must be dropped.

export type BonvoyClaims = z.infer<typeof BonvoyClaimsSchema>;

// ---------------------------------------------------------------------------
// InternalPrincipal — fields that may appear in Voya's internal JWT
//
// This schema governs what is placed into issued tokens. It intentionally
// excludes name, email, Bonvoy number, passport data, payment data, and raw
// upstream claim sets. Using .strict() means any attempt to add undeclared
// fields fails at validation time.
// ---------------------------------------------------------------------------

export const InternalPrincipalSchema = z
  .object({
    sub:        z.string().min(1), // travellerRef (tokenised, not Bonvoy account)
    tier:       BonvoyMemberTierEnum,
    roles:      z.array(z.string().min(1)),
    session_id: z.string().min(1),
    iss:        z.string().min(1),
    aud:        z.string().min(1),
    iat:        z.number().int(),
    exp:        z.number().int(),
  })
  .strict();

export type InternalPrincipal = z.infer<typeof InternalPrincipalSchema>;

// ---------------------------------------------------------------------------
// PrincipalSummary — POST /v1/auth/bonvoy/callback response body
// ---------------------------------------------------------------------------

export const PrincipalSummarySchema = z
  .object({
    travellerRef: z.string().min(1),
    tier:         BonvoyMemberTierEnum,
    sessionId:    z.string().min(1),
    isNewProfile: z.boolean(),
  })
  .strict();

export type PrincipalSummary = z.infer<typeof PrincipalSummarySchema>;
