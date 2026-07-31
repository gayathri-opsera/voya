/**
 * Unit tests for createPrincipalFactory.
 *
 * Verifies:
 * - Principal minimisation (no PII, no upstream claims)
 * - Tier extraction and normalisation
 * - AUTH_TIER_MISSING when verified_tier is absent
 * - InternalPrincipal has exactly the allowed fields
 */

import { describe, it, expect } from 'vitest';
import { createPrincipalFactory } from '../../src/domain/principalFactory.js';
import { InternalPrincipalSchema, AuthErrorCode, BonvoyMemberTier } from '@voya/contracts';
import type { BonvoyClaims } from '@voya/contracts';
import {
  validPlatinumClaims,
  validGoldClaims,
  validMemberNoTierClaims,
  MOCK_BONVOY_ISSUER,
  MOCK_BONVOY_CLIENT_ID,
} from '../fixtures/bonvoyOidc.js';

const FIXED_NOW     = 1735689600;
const SESSION_TTL   = 3600;
const TEST_SESSION  = 'session-id-test-001';
const TRAVELLER_REF = 'owner_ref_auth_test_001';

const INTERNAL_ISSUER   = 'https://api.voya.test';
const INTERNAL_AUDIENCE = 'voya-internal';

function makeFactory() {
  return createPrincipalFactory({
    internalIssuer:   INTERNAL_ISSUER,
    internalAudience: INTERNAL_AUDIENCE,
    sessionTtlSeconds: SESSION_TTL,
    clock:       () => FIXED_NOW,
    idGenerator: () => TEST_SESSION,
  });
}

// ---------------------------------------------------------------------------
// Success cases
// ---------------------------------------------------------------------------

describe('createPrincipalFactory — success', () => {
  it('builds a valid InternalPrincipal for a Platinum member', () => {
    const factory = makeFactory();
    const result  = factory.buildPrincipal(TRAVELLER_REF, validPlatinumClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { principal } = result;
    expect(principal.sub).toBe(TRAVELLER_REF);
    expect(principal.tier).toBe(BonvoyMemberTier.PLATINUM);
    expect(principal.roles).toEqual(['member']);
    expect(principal.session_id).toBe(TEST_SESSION);
    expect(principal.iss).toBe(INTERNAL_ISSUER);
    expect(principal.aud).toBe(INTERNAL_AUDIENCE);
    expect(principal.iat).toBe(FIXED_NOW);
    expect(principal.exp).toBe(FIXED_NOW + SESSION_TTL);
  });

  it('builds a valid InternalPrincipal for a Gold member', () => {
    const factory = makeFactory();
    const result  = factory.buildPrincipal(TRAVELLER_REF, validGoldClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.tier).toBe(BonvoyMemberTier.GOLD);
  });

  it('passes InternalPrincipalSchema validation', () => {
    const factory = makeFactory();
    const result  = factory.buildPrincipal(TRAVELLER_REF, validPlatinumClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = InternalPrincipalSchema.safeParse(result.principal);
    expect(parsed.success).toBe(true);
  });

  it('normalises lowercase tier string to enum value', () => {
    const factory = makeFactory();
    const claimsWithLowerTier: BonvoyClaims = {
      ...validPlatinumClaims,
      verified_tier: 'platinum',
    };
    const result = factory.buildPrincipal(TRAVELLER_REF, claimsWithLowerTier);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.tier).toBe(BonvoyMemberTier.PLATINUM);
  });

  it('falls back to MEMBER for unrecognised tier string', () => {
    const factory = makeFactory();
    const claimsWithUnknownTier: BonvoyClaims = {
      ...validPlatinumClaims,
      verified_tier: 'DIAMOND_ELITE_PLUS',
    };
    const result = factory.buildPrincipal(TRAVELLER_REF, claimsWithUnknownTier);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.tier).toBe(BonvoyMemberTier.MEMBER);
  });
});

// ---------------------------------------------------------------------------
// Principal minimisation
// ---------------------------------------------------------------------------

describe('createPrincipalFactory — principal minimisation', () => {
  it('principal does NOT contain upstream sub (uses travellerRef as sub)', () => {
    const factory = makeFactory();
    const result  = factory.buildPrincipal(TRAVELLER_REF, validPlatinumClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // sub should be the internal travellerRef, not the Bonvoy sub
    expect(result.principal.sub).toBe(TRAVELLER_REF);
    expect(result.principal.sub).not.toBe(validPlatinumClaims.sub);
  });

  it('principal does NOT contain iss from upstream token', () => {
    const factory = makeFactory();
    const result  = factory.buildPrincipal(TRAVELLER_REF, validPlatinumClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // iss should be the Voya internal issuer, not the Bonvoy issuer
    expect(result.principal.iss).toBe(INTERNAL_ISSUER);
    expect(result.principal.iss).not.toBe(MOCK_BONVOY_ISSUER);
  });

  it('principal does NOT contain aud from upstream token', () => {
    const factory = makeFactory();
    const result  = factory.buildPrincipal(TRAVELLER_REF, validPlatinumClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.aud).toBe(INTERNAL_AUDIENCE);
    expect(result.principal.aud).not.toBe(MOCK_BONVOY_CLIENT_ID);
  });

  it('InternalPrincipalSchema (.strict) rejects any added personal data field', () => {
    const factory = makeFactory();
    const result  = factory.buildPrincipal(TRAVELLER_REF, validPlatinumClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Attempt to add email — strict schema must reject it
    const withEmail = { ...result.principal, email: 'test@example.invalid' };
    const parsed    = InternalPrincipalSchema.safeParse(withEmail);
    expect(parsed.success).toBe(false);
  });

  it('InternalPrincipalSchema (.strict) rejects a Bonvoy number field', () => {
    const factory = makeFactory();
    const result  = factory.buildPrincipal(TRAVELLER_REF, validPlatinumClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const withBonvoy = { ...result.principal, bonvoy_number: '123456789' };
    const parsed     = InternalPrincipalSchema.safeParse(withBonvoy);
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Missing tier guard
// ---------------------------------------------------------------------------

describe('createPrincipalFactory — AUTH_TIER_MISSING', () => {
  it('returns AUTH_TIER_MISSING when verified_tier is absent', () => {
    const factory = makeFactory();
    const claimsNoTier = validMemberNoTierClaims as BonvoyClaims;
    const result  = factory.buildPrincipal(TRAVELLER_REF, claimsNoTier);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_TIER_MISSING);
  });

  it('returns AUTH_TIER_MISSING when verified_tier is empty string', () => {
    const factory = makeFactory();
    const claimsEmptyTier: BonvoyClaims = {
      ...validPlatinumClaims,
      verified_tier: '',
    };
    const result = factory.buildPrincipal(TRAVELLER_REF, claimsEmptyTier);
    // empty string is falsy — normaliseTier would get '', but the guard checks !claims.verified_tier
    // ''.toUpperCase() = '' which is not in tierValues, so falls back to MEMBER
    // But the guard `if (!claims.verified_tier)` catches empty string
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(AuthErrorCode.AUTH_TIER_MISSING);
  });
});

// ---------------------------------------------------------------------------
// Account-link lookup simulation (structural tests)
// ---------------------------------------------------------------------------

describe('createPrincipalFactory — account-link lookup compatibility', () => {
  it('uses provided travellerRef as sub regardless of claims.sub', () => {
    const factory          = makeFactory();
    const differentRef     = 'owner_ref_different_002';
    const result           = factory.buildPrincipal(differentRef, validPlatinumClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.sub).toBe(differentRef);
  });

  it('session_id is populated from injected idGenerator', () => {
    let callCount = 0;
    const trackingGenerator = () => {
      callCount++;
      return `session-gen-${callCount}`;
    };
    const factory = createPrincipalFactory({
      internalIssuer:   INTERNAL_ISSUER,
      internalAudience: INTERNAL_AUDIENCE,
      sessionTtlSeconds: SESSION_TTL,
      clock:       () => FIXED_NOW,
      idGenerator: trackingGenerator,
    });

    const result1 = factory.buildPrincipal(TRAVELLER_REF, validPlatinumClaims);
    const result2 = factory.buildPrincipal(TRAVELLER_REF, validGoldClaims);
    expect(result1.ok && result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;
    expect(result1.principal.session_id).toBe('session-gen-1');
    expect(result2.principal.session_id).toBe('session-gen-2');
  });
});
