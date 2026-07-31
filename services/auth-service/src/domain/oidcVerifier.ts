/**
 * OIDC verifier — validates Bonvoy ID tokens.
 *
 * All external dependencies (JWKS resolver, raw token verifier, clock) are
 * injected so this module can be unit-tested offline without network calls.
 * The verifier does NOT import Express, Prisma, or any HTTP client.
 */

import { BonvoyClaimsSchema, AuthErrorCode } from '@voya/contracts';
import type { BonvoyClaims } from '@voya/contracts';

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

export type JwkKey = {
  readonly kty: string;
  readonly kid?: string;
  readonly alg?: string;
  readonly use?: string;
  readonly n?: string;
  readonly e?: string;
  readonly [key: string]: unknown;
};

export type JwkSet = {
  readonly keys: readonly JwkKey[];
};

/**
 * Verifies the cryptographic signature of a raw JWT using the provided JWKS
 * and returns the decoded payload. Throws on any verification failure.
 *
 * In production, this is implemented with the `jose` library.
 * In tests, pass a mock that validates a test signing scheme.
 */
export type RawTokenVerifier = (
  rawToken: string,
  jwks: JwkSet,
) => Promise<Record<string, unknown>>;

export interface OidcVerifierDeps {
  /** Expected OIDC issuer URL (e.g. https://auth.bonvoy.example.com) */
  readonly issuer: string;
  /** Expected audience — must match this value in ID token aud claim. */
  readonly audience: string;
  /** Maximum tolerated clock skew in seconds (default: 30). */
  readonly maxClockSkewSeconds: number;
  /** Returns current Unix timestamp (seconds). Injected for deterministic tests. */
  readonly clock: () => number;
  /** Fetches the JWKS document for the given issuer. Throws on network failure. */
  readonly jwksResolver: (issuer: string) => Promise<JwkSet>;
  /** Verifies the raw token's signature and returns its payload. Throws on failure. */
  readonly rawTokenVerifier: RawTokenVerifier;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type OidcVerifyOutcome =
  | { readonly ok: true;  readonly claims: BonvoyClaims }
  | { readonly ok: false; readonly code: string; readonly message: string };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOidcVerifier(deps: OidcVerifierDeps) {
  return {
    /**
     * Verify a raw OIDC ID token JWT.
     *
     * Checks (in order):
     *   1. JWKS resolves successfully
     *   2. Signature is valid
     *   3. Claims match BonvoyClaimsSchema shape
     *   4. iss matches expected issuer
     *   5. aud contains expected audience
     *   6. Token is not expired (with clock skew tolerance)
     *   7. nonce matches expectedNonce
     *
     * Returns OidcVerifyOutcome — never throws.
     */
    async verifyIdToken(
      rawToken: string,
      expectedNonce: string,
    ): Promise<OidcVerifyOutcome> {
      // Step 1: Resolve JWKS
      let jwks: JwkSet;
      try {
        jwks = await deps.jwksResolver(deps.issuer);
      } catch {
        return {
          ok: false,
          code: AuthErrorCode.AUTH_PROVIDER_UNAVAILABLE,
          message: 'JWKS endpoint unavailable — Bonvoy provider could not be reached',
        };
      }

      // Step 2: Verify signature and decode payload
      let rawPayload: Record<string, unknown>;
      try {
        rawPayload = await deps.rawTokenVerifier(rawToken, jwks);
      } catch {
        return {
          ok: false,
          code: AuthErrorCode.AUTH_SIGNATURE_INVALID,
          message: 'ID token signature verification failed',
        };
      }

      // Step 3: Validate claims shape
      const parsed = BonvoyClaimsSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return {
          ok: false,
          code: AuthErrorCode.AUTH_SIGNATURE_INVALID,
          message: 'ID token claims do not match expected shape',
        };
      }

      const claims = parsed.data;

      // Step 4: Issuer check
      if (claims.iss !== deps.issuer) {
        return {
          ok: false,
          code: AuthErrorCode.AUTH_WRONG_ISSUER,
          message: `Unexpected issuer: expected ${deps.issuer}`,
        };
      }

      // Step 5: Audience check
      const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!audList.includes(deps.audience)) {
        return {
          ok: false,
          code: AuthErrorCode.AUTH_WRONG_AUDIENCE,
          message: 'ID token audience does not include the expected client ID',
        };
      }

      // Step 6: Expiry check (allow positive clock skew)
      const now = deps.clock();
      if (claims.exp + deps.maxClockSkewSeconds < now) {
        return {
          ok: false,
          code: AuthErrorCode.AUTH_TOKEN_EXPIRED,
          message: 'ID token has expired',
        };
      }

      // Step 7: Nonce check
      if (claims.nonce !== expectedNonce) {
        return {
          ok: false,
          code: AuthErrorCode.AUTH_NONCE_INVALID,
          message: 'ID token nonce does not match the stored nonce',
        };
      }

      return { ok: true, claims };
    },
  };
}

export type OidcVerifier = ReturnType<typeof createOidcVerifier>;
