/**
 * Unit tests for createOidcVerifier.
 *
 * All tests run offline — no network calls. The JWKS resolver and
 * rawTokenVerifier are injected mocks.
 */

import { describe, it, expect } from 'vitest';
import { createOidcVerifier } from '../../src/domain/oidcVerifier.js';
import { AuthErrorCode } from '@voya/contracts';
import {
  MOCK_BONVOY_ISSUER,
  MOCK_BONVOY_CLIENT_ID,
  mockJwkSet,
  mockJwksResolver,
  failingJwksResolver,
  mockRawTokenVerifier,
  validPlatinumClaims,
  validGoldClaims,
  wrongIssuerClaims,
  wrongAudienceClaims,
  expiredClaims,
  wrongNonceClaims,
  validPlatinumToken,
  validGoldToken,
  wrongIssuerToken,
  wrongAudienceToken,
  expiredToken,
  wrongNonceToken,
  malformedToken,
} from '../fixtures/bonvoyOidc.js';

const BASE_NOW = 1735689600; // matches fixture timestamps

function makeVerifier(overrides: Partial<Parameters<typeof createOidcVerifier>[0]> = {}) {
  return createOidcVerifier({
    issuer:             MOCK_BONVOY_ISSUER,
    audience:           MOCK_BONVOY_CLIENT_ID,
    maxClockSkewSeconds: 30,
    clock:              () => BASE_NOW + 1, // 1 second after iat
    jwksResolver:       mockJwksResolver,
    rawTokenVerifier:   mockRawTokenVerifier,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Success cases
// ---------------------------------------------------------------------------

describe('createOidcVerifier — success', () => {
  it('returns ok=true and claims for a valid Platinum token', async () => {
    const verifier = makeVerifier();
    const result = await verifier.verifyIdToken(
      validPlatinumToken,
      validPlatinumClaims.nonce,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims.sub).toBe(validPlatinumClaims.sub);
    expect(result.claims.verified_tier).toBe('PLATINUM');
  });

  it('returns ok=true and claims for a valid Gold token', async () => {
    const verifier = makeVerifier();
    const result = await verifier.verifyIdToken(
      validGoldToken,
      validGoldClaims.nonce,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims.verified_tier).toBe('GOLD');
  });

  it('accepts token with aud as an array containing the expected audience', async () => {
    const arrayAudClaims = { ...validPlatinumClaims, aud: [MOCK_BONVOY_CLIENT_ID, 'other-aud'] };
    const mockArrayAudVerifier = (_t: string, _j: typeof mockJwkSet) =>
      Promise.resolve(arrayAudClaims as Record<string, unknown>);
    const verifier = makeVerifier({ rawTokenVerifier: mockArrayAudVerifier });
    const result = await verifier.verifyIdToken('token', validPlatinumClaims.nonce);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// JWKS / provider failure
// ---------------------------------------------------------------------------

describe('createOidcVerifier — provider failures', () => {
  it('returns AUTH_PROVIDER_UNAVAILABLE when JWKS resolver throws', async () => {
    const verifier = makeVerifier({ jwksResolver: failingJwksResolver });
    const result = await verifier.verifyIdToken(validPlatinumToken, validPlatinumClaims.nonce);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_PROVIDER_UNAVAILABLE);
  });

  it('returns AUTH_SIGNATURE_INVALID when rawTokenVerifier throws', async () => {
    const failingVerifier = () => Promise.reject(new Error('Signature mismatch'));
    const verifier = makeVerifier({ rawTokenVerifier: failingVerifier });
    const result = await verifier.verifyIdToken(malformedToken, 'any-nonce');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_SIGNATURE_INVALID);
  });
});

// ---------------------------------------------------------------------------
// Claim validation
// ---------------------------------------------------------------------------

describe('createOidcVerifier — claim validation', () => {
  it('returns AUTH_WRONG_ISSUER for token with unexpected issuer', async () => {
    const verifier = makeVerifier();
    const result = await verifier.verifyIdToken(wrongIssuerToken, wrongIssuerClaims.nonce);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_WRONG_ISSUER);
  });

  it('returns AUTH_WRONG_AUDIENCE for token with unexpected audience', async () => {
    const verifier = makeVerifier();
    const result = await verifier.verifyIdToken(wrongAudienceToken, wrongAudienceClaims.nonce);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_WRONG_AUDIENCE);
  });

  it('returns AUTH_TOKEN_EXPIRED for an expired token (beyond clock skew)', async () => {
    // Clock is 7200 seconds after exp; maxClockSkew is 30 seconds
    const verifier = makeVerifier({ clock: () => BASE_NOW + 7200 });
    const result = await verifier.verifyIdToken(expiredToken, expiredClaims.nonce);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_TOKEN_EXPIRED);
  });

  it('accepts a token within the clock skew window', async () => {
    // Token exp = BASE_NOW - 3600; maxClockSkew = 30; clock = BASE_NOW - 3600 + 15 (within skew)
    // This would succeed because exp + 30 >= clock
    const verifier = makeVerifier({ clock: () => expiredClaims.exp + 15 });
    const result = await verifier.verifyIdToken(expiredToken, expiredClaims.nonce);
    // expiredClaims.nonce check will fail (wrong nonce), but we reach the nonce check
    // meaning issuer/audience/expiry all passed
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Should fail at nonce, not expiry
    expect(result.code).toBe(AuthErrorCode.AUTH_NONCE_INVALID);
  });

  it('returns AUTH_NONCE_INVALID for token with wrong nonce', async () => {
    const verifier = makeVerifier();
    const result = await verifier.verifyIdToken(wrongNonceToken, validPlatinumClaims.nonce);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_NONCE_INVALID);
  });

  it('returns AUTH_SIGNATURE_INVALID for malformed token payload', async () => {
    const throwingVerifier = () => Promise.reject(new Error('Cannot decode'));
    const verifier = makeVerifier({ rawTokenVerifier: throwingVerifier });
    const result = await verifier.verifyIdToken(malformedToken, 'any-nonce');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_SIGNATURE_INVALID);
  });
});

// ---------------------------------------------------------------------------
// Replay detection (nonce mismatch serves as replay guard)
// ---------------------------------------------------------------------------

describe('createOidcVerifier — replay detection', () => {
  it('rejects a token when the nonce does not match the stored value', async () => {
    const verifier = makeVerifier();
    const result = await verifier.verifyIdToken(
      validPlatinumToken,
      'different-nonce-value', // simulate replayed nonce
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_NONCE_INVALID);
  });
});
