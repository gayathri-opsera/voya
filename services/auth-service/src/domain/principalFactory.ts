/**
 * Principal factory — maps verified Bonvoy claims to a minimal internal principal.
 *
 * The factory explicitly drops ALL upstream claims not required by Voya's
 * internal routing, rate resolution, and loyalty estimation surfaces.
 * Name, email, Bonvoy account number, passport data, payment data, and raw
 * upstream claim sets MUST NOT appear in the resulting principal.
 */

import { BonvoyMemberTier, AuthErrorCode } from '@voya/contracts';
import type { BonvoyClaims, InternalPrincipal } from '@voya/contracts';

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

export type PrincipalFactoryDeps = {
  /** Voya's own token issuer identifier (e.g. https://api.voya.example.com) */
  readonly internalIssuer: string;
  /** Intended audience for Voya-issued internal tokens */
  readonly internalAudience: string;
  /** Session validity in seconds (default: 3600) */
  readonly sessionTtlSeconds: number;
  /** Returns current Unix timestamp (seconds). Injected for deterministic tests. */
  readonly clock: () => number;
  /** Generates a unique session ID. Injected for deterministic tests. */
  readonly idGenerator: () => string;
};

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type PrincipalFactoryResult =
  | { readonly ok: true;  readonly principal: InternalPrincipal }
  | { readonly ok: false; readonly code: string; readonly message: string };

// ---------------------------------------------------------------------------
// Tier normalisation helper
// ---------------------------------------------------------------------------

/** Maps a raw Bonvoy tier string to the BonvoyMemberTier enum. */
function normaliseTier(raw: string): typeof BonvoyMemberTier[keyof typeof BonvoyMemberTier] {
  const upper = raw.toUpperCase().trim();
  const tierValues = Object.values(BonvoyMemberTier) as string[];
  if (tierValues.includes(upper)) {
    return upper as typeof BonvoyMemberTier[keyof typeof BonvoyMemberTier];
  }
  // Any unrecognised tier string is treated as base MEMBER
  return BonvoyMemberTier.MEMBER;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPrincipalFactory(deps: PrincipalFactoryDeps) {
  return {
    /**
     * Build an InternalPrincipal from a travellerRef and verified BonvoyClaims.
     *
     * - Requires verified_tier to be present in claims.
     * - Returns AUTH_TIER_MISSING if verified_tier is absent.
     * - The resulting principal contains ONLY sub, tier, roles, session_id,
     *   iss, aud, iat, exp. All other upstream fields are dropped.
     */
    buildPrincipal(
      travellerRef: string,
      claims: BonvoyClaims,
    ): PrincipalFactoryResult {
      if (!claims.verified_tier) {
        return {
          ok: false,
          code: AuthErrorCode.AUTH_TIER_MISSING,
          message:
            'Bonvoy ID token is missing the required verified_tier claim; ' +
            'member rates, benefits, and loyalty features require a verified tier',
        };
      }

      const tier = normaliseTier(claims.verified_tier);
      const now  = deps.clock();

      // Build principal with ONLY allowed fields — structural spread of
      // claims is intentionally avoided to prevent accidental PII inclusion.
      const principal: InternalPrincipal = {
        sub:        travellerRef,
        tier,
        roles:      ['member'],
        session_id: deps.idGenerator(),
        iss:        deps.internalIssuer,
        aud:        deps.internalAudience,
        iat:        now,
        exp:        now + deps.sessionTtlSeconds,
      };

      return { ok: true, principal };
    },
  };
}

export type PrincipalFactory = ReturnType<typeof createPrincipalFactory>;
