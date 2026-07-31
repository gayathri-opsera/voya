/**
 * @voya/contracts — Authentication domain types
 *
 * Re-exports from schemas.ts for consumers who only need TypeScript types
 * without importing the Zod runtime. Also declares the OidcProvider
 * string-literal type used in IdentityAccountLink.
 */

export type {
  BonvoyMemberTier,
  AuthErrorCode,
  AuthStartRequest,
  AuthCallbackRequest,
  BonvoyClaims,
  InternalPrincipal,
  PrincipalSummary,
} from './schemas.js';

export {
  BonvoyMemberTier,
  AuthErrorCode,
  BonvoyMemberTierEnum,
  AuthErrorCodeEnum,
  AuthStartRequestSchema,
  AuthCallbackRequestSchema,
  BonvoyClaimsSchema,
  InternalPrincipalSchema,
  PrincipalSummarySchema,
} from './schemas.js';

/** Identifier for the Bonvoy identity provider stored in identity_account_link. */
export type OidcProvider = 'bonvoy';
export const OIDC_PROVIDER_BONVOY: OidcProvider = 'bonvoy';
