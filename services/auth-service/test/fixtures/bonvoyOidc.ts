/**
 * Mock Bonvoy OIDC fixtures for unit and integration tests.
 *
 * All identifiers are synthetic. No real Bonvoy account numbers, emails,
 * names, passport values, or payment data appear in this file.
 *
 * Testing convention: in unit/integration tests the rawTokenVerifier is a
 * mock that decodes a dot-delimited "header.payload.sig" string where payload
 * is a base64url-encoded JSON object. This avoids needing a real RSA keypair
 * in the test environment while still exercising all validation paths.
 */

import type { JwkSet, JwkKey } from '../../src/domain/oidcVerifier.js';
import type { BonvoyClaims } from '@voya/contracts';

// ---------------------------------------------------------------------------
// Mock OIDC provider metadata
// ---------------------------------------------------------------------------

export const MOCK_BONVOY_ISSUER   = 'https://auth.bonvoy.test';
export const MOCK_BONVOY_CLIENT_ID = 'voya-test-client-id';
export const MOCK_BONVOY_AUTH_URL  = 'https://auth.bonvoy.test/oauth2/authorize';
export const MOCK_BONVOY_TOKEN_URL = 'https://auth.bonvoy.test/oauth2/token';
export const MOCK_VOYA_REDIRECT_URI = 'https://voya.test/v1/auth/bonvoy/callback';

/** OIDC discovery document for the mock Bonvoy provider. */
export const mockDiscoveryDocument = {
  issuer:                                MOCK_BONVOY_ISSUER,
  authorization_endpoint:               MOCK_BONVOY_AUTH_URL,
  token_endpoint:                        MOCK_BONVOY_TOKEN_URL,
  jwks_uri:                              `${MOCK_BONVOY_ISSUER}/.well-known/jwks.json`,
  response_types_supported:             ['code'],
  subject_types_supported:              ['pairwise'],
  id_token_signing_alg_values_supported: ['RS256'],
  scopes_supported:                      ['openid'],
  code_challenge_methods_supported:      ['S256'],
  claims_supported:                      ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce', 'verified_tier'],
};

// ---------------------------------------------------------------------------
// Mock JWKS — test-only key material; no real private key
// ---------------------------------------------------------------------------

export const MOCK_TEST_KEY_ID = 'test-key-2025-06';

export const mockJwk: JwkKey = {
  kty: 'RSA',
  kid: MOCK_TEST_KEY_ID,
  use: 'sig',
  alg: 'RS256',
  // Synthetic modulus/exponent — not a real key, used only in mock verifier
  n: 'MOCK_MODULUS_PLACEHOLDER_NOT_A_REAL_RSA_KEY',
  e: 'AQAB',
};

export const mockJwkSet: JwkSet = {
  keys: [mockJwk],
};

// ---------------------------------------------------------------------------
// Token encoding helpers (test-only, not used in production)
// ---------------------------------------------------------------------------

function base64urlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json).toString('base64url');
}

function buildMockToken(payload: BonvoyClaims): string {
  const header = base64urlEncode({ alg: 'RS256', kid: MOCK_TEST_KEY_ID, typ: 'JWT' });
  const body   = base64urlEncode(payload);
  // Signature is a deterministic placeholder for test purposes
  const sig    = base64urlEncode({ mock: true });
  return `${header}.${body}.${sig}`;
}

// ---------------------------------------------------------------------------
// Raw token verifier (mock) — decodes payload without real signature check
//
// Only for use in tests. Verifies that the kid is present in the JWKS and
// decodes the base64url payload. Throws if token is malformed.
// ---------------------------------------------------------------------------

export function mockRawTokenVerifier(
  rawToken: string,
  jwks: JwkSet,
): Promise<Record<string, unknown>> {
  const parts = rawToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed mock token: expected 3 dot-separated parts');
  }

  // Verify the kid is known
  const headerStr = parts[0] ?? '';
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerStr, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new Error('Malformed mock token header');
  }

  const kid = header['kid'] as string | undefined;
  if (kid && !jwks.keys.some(k => k.kid === kid)) {
    throw new Error(`Unknown kid "${kid}" — not in JWKS`);
  }

  // Decode payload
  const payloadStr = parts[1] ?? '';
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new Error('Malformed mock token payload');
  }

  return Promise.resolve(payload);
}

// ---------------------------------------------------------------------------
// JWKS resolver mock
// ---------------------------------------------------------------------------

export function mockJwksResolver(_issuer: string): Promise<JwkSet> {
  return Promise.resolve(mockJwkSet);
}

export function failingJwksResolver(_issuer: string): Promise<JwkSet> {
  return Promise.reject(new Error('Simulated JWKS endpoint failure'));
}

// ---------------------------------------------------------------------------
// Valid ID token payloads
// ---------------------------------------------------------------------------

const BASE_NOW = 1735689600; // 2025-01-01T00:00:00Z (fixed for deterministic tests)

/** Valid claims for a Platinum member. */
export const validPlatinumClaims: BonvoyClaims = {
  sub:           'bonvoy-sub-synthetic-pt001',
  iss:           MOCK_BONVOY_ISSUER,
  aud:           MOCK_BONVOY_CLIENT_ID,
  exp:           BASE_NOW + 3600,
  iat:           BASE_NOW,
  nonce:         'test-nonce-hash-platinum-001',
  verified_tier: 'PLATINUM',
};

/** Valid claims for a Gold member. */
export const validGoldClaims: BonvoyClaims = {
  sub:           'bonvoy-sub-synthetic-gd001',
  iss:           MOCK_BONVOY_ISSUER,
  aud:           MOCK_BONVOY_CLIENT_ID,
  exp:           BASE_NOW + 3600,
  iat:           BASE_NOW,
  nonce:         'test-nonce-hash-gold-001',
  verified_tier: 'GOLD',
};

/** Valid claims for a base member (no tier string). */
export const validMemberNoTierClaims: Omit<BonvoyClaims, 'verified_tier'> & { verified_tier?: undefined } = {
  sub:   'bonvoy-sub-synthetic-mb001',
  iss:   MOCK_BONVOY_ISSUER,
  aud:   MOCK_BONVOY_CLIENT_ID,
  exp:   BASE_NOW + 3600,
  iat:   BASE_NOW,
  nonce: 'test-nonce-hash-member-001',
};

/** Claims with wrong issuer. */
export const wrongIssuerClaims: BonvoyClaims = {
  ...validPlatinumClaims,
  sub:   'bonvoy-sub-synthetic-wi001',
  nonce: 'test-nonce-hash-wi-001',
  iss:   'https://malicious.example.com',
};

/** Claims with wrong audience. */
export const wrongAudienceClaims: BonvoyClaims = {
  ...validPlatinumClaims,
  sub:   'bonvoy-sub-synthetic-wa001',
  nonce: 'test-nonce-hash-wa-001',
  aud:   'wrong-client-id',
};

/** Claims with exp in the past (expired token). */
export const expiredClaims: BonvoyClaims = {
  ...validPlatinumClaims,
  sub:   'bonvoy-sub-synthetic-ex001',
  nonce: 'test-nonce-hash-ex-001',
  exp:   BASE_NOW - 3600,
};

/** Claims with wrong nonce (replay scenario). */
export const wrongNonceClaims: BonvoyClaims = {
  ...validPlatinumClaims,
  sub:   'bonvoy-sub-synthetic-wn001',
  nonce: 'wrong-nonce-value',
};

// ---------------------------------------------------------------------------
// Raw mock tokens
// ---------------------------------------------------------------------------

export const validPlatinumToken   = buildMockToken(validPlatinumClaims);
export const validGoldToken       = buildMockToken(validGoldClaims);
export const wrongIssuerToken     = buildMockToken(wrongIssuerClaims);
export const wrongAudienceToken   = buildMockToken(wrongAudienceClaims);
export const expiredToken         = buildMockToken(expiredClaims);
export const wrongNonceToken      = buildMockToken(wrongNonceClaims);

/** A token with a malformed payload (not valid JSON). */
export const malformedToken = 'not.a.valid.jwt.at.all';

// ---------------------------------------------------------------------------
// Callback request examples
// ---------------------------------------------------------------------------

export const validCallbackBody = {
  code:  validPlatinumToken, // test fixture convention: code = raw ID token
  state: 'test-state-value-platinum-001',
};

export const replayedCallbackBody = {
  code:  validPlatinumToken,
  state: 'already-consumed-state-001',
};

// ---------------------------------------------------------------------------
// Expected principal snapshots
// ---------------------------------------------------------------------------

export const expectedPlatinumPrincipalShape = {
  tier:         'PLATINUM',
  roles:        ['member'],
  iss:          'https://api.voya.test',
  aud:          'voya-internal',
  // sub, session_id, iat, exp vary per test run
} as const;
