/**
 * Integration tests for the Bonvoy OIDC auth flow.
 *
 * Tests the complete pipeline:
 *   bonvoyStart route → challenge store → bonvoyCallback route
 *     → oidcVerifier → principalFactory → profile upsert → response
 *
 * Uses:
 * - In-memory ChallengeRepository and ProfileRepository fakes
 * - Mock OIDC fixtures from bonvoyOidc.ts
 * - No Express HTTP server (tests call route handlers directly via mock req/res)
 * - No database required (skipIf pattern not needed — no DB used)
 *
 * Edge cases covered:
 * - Successful login (Platinum tier)
 * - Replayed callback (challenge already consumed)
 * - Expired token rejection
 * - Wrong audience rejection
 * - Missing verified_tier rejection (403)
 * - Provider unavailable (502)
 * - Returning traveller (existing identity link)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createOidcVerifier } from '../../src/domain/oidcVerifier.js';
import { createPrincipalFactory } from '../../src/domain/principalFactory.js';
import { createBonvoyCallbackRoute } from '../../src/routes/bonvoyCallback.js';
import { AuthErrorCode, BonvoyMemberTier } from '@voya/contracts';
import type { AuthServiceDeps, ChallengeRepository, ProfileRepository, StoredChallenge } from '../../src/types.js';
import {
  MOCK_BONVOY_ISSUER,
  MOCK_BONVOY_CLIENT_ID,
  MOCK_BONVOY_AUTH_URL,
  MOCK_BONVOY_TOKEN_URL,
  MOCK_VOYA_REDIRECT_URI,
  mockJwksResolver,
  failingJwksResolver,
  mockRawTokenVerifier,
  validPlatinumClaims,
  validMemberNoTierClaims,
  wrongAudienceClaims,
  expiredClaims,
  validPlatinumToken,
  wrongAudienceToken,
  expiredToken,
} from '../fixtures/bonvoyOidc.js';
import { sha256Hex } from '../../src/lib/pkce.js';

const BASE_NOW    = 1735689600;
const FIXED_STATE = 'integration-test-state-001';

// ---------------------------------------------------------------------------
// In-memory fakes
// ---------------------------------------------------------------------------

class FakeChallengeRepository implements ChallengeRepository {
  private readonly challenges = new Map<string, {
    nonceHash:        string;
    pkceVerifierHash: string;
    correlationId:    string;
    expiresAt:        Date;
    consumed:         boolean;
  }>();

  async createChallenge(params: Parameters<ChallengeRepository['createChallenge']>[0]): Promise<void> {
    this.challenges.set(params.stateHash, {
      nonceHash:        params.nonceHash,
      pkceVerifierHash: params.pkceVerifierHash,
      correlationId:    params.correlationId,
      expiresAt:        params.expiresAt,
      consumed:         false,
    });
  }

  async findAndConsumeChallenge(stateHash: string): Promise<StoredChallenge | null> {
    const ch = this.challenges.get(stateHash);
    if (!ch) return null;
    if (ch.consumed) return null;
    if (ch.expiresAt < new Date(BASE_NOW * 1000)) return null;
    ch.consumed = true;
    return { nonceHash: ch.nonceHash, pkceVerifierHash: ch.pkceVerifierHash, correlationId: ch.correlationId };
  }

  seed(stateHash: string, nonceHash: string, pkceVerifierHash: string, correlationId: string) {
    this.challenges.set(stateHash, {
      nonceHash,
      pkceVerifierHash,
      correlationId,
      expiresAt: new Date((BASE_NOW + 3600) * 1000),
      consumed: false,
    });
  }

  seedConsumed(stateHash: string) {
    this.challenges.set(stateHash, {
      nonceHash: 'consumed-nonce',
      pkceVerifierHash: 'consumed-pkce',
      correlationId: 'corr-consumed',
      expiresAt: new Date((BASE_NOW + 3600) * 1000),
      consumed: true,
    });
  }
}

class FakeProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, { travellerRef: string }>();

  async findByProviderSubjectHash(_provider: string, providerSubjectHash: string) {
    return this.profiles.get(providerSubjectHash) ?? null;
  }

  async upsertProfileWithLink(params: Parameters<ProfileRepository['upsertProfileWithLink']>[0]) {
    const existing = this.profiles.get(params.providerSubjectHash);
    if (existing) {
      return { travellerRef: existing.travellerRef, isNew: false };
    }
    const travellerRef = `owner_ref_test_${params.providerSubjectHash.slice(0, 8)}`;
    this.profiles.set(params.providerSubjectHash, { travellerRef });
    return { travellerRef, isNew: true };
  }

  async updateLastLogin(_params: Parameters<ProfileRepository['updateLastLogin']>[0]): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Mock req/res helpers
// ---------------------------------------------------------------------------

function mockReq(body: Record<string, unknown>): { body: Record<string, unknown> } {
  return { body };
}

function mockRes() {
  let statusCode = 200;
  let body: unknown;
  return {
    status(code: number) { statusCode = code; return this; },
    json(payload: unknown) { body = payload; return this; },
    redirect(_code: number, _url: string) { statusCode = _code; return this; },
    get statusCode() { return statusCode; },
    get body() { return body; },
    locals: {} as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function makeCallbackDeps(
  jwksOverride?: typeof mockJwksResolver,
  challengeRepo?: FakeChallengeRepository,
  profileRepo?: FakeProfileRepository,
): AuthServiceDeps & { challengeRepo: FakeChallengeRepository; profileRepo: FakeProfileRepository } {
  const cr = challengeRepo ?? new FakeChallengeRepository();
  const pr = profileRepo  ?? new FakeProfileRepository();

  return {
    bonvoyAuthUrl:      MOCK_BONVOY_AUTH_URL,
    bonvoyClientId:     MOCK_BONVOY_CLIENT_ID,
    bonvoyRedirectUri:  MOCK_VOYA_REDIRECT_URI,
    bonvoyTokenUrl:     MOCK_BONVOY_TOKEN_URL,
    oidcVerifier: createOidcVerifier({
      issuer:              MOCK_BONVOY_ISSUER,
      audience:            MOCK_BONVOY_CLIENT_ID,
      maxClockSkewSeconds: 30,
      clock:               () => BASE_NOW + 1,
      jwksResolver:        jwksOverride ?? mockJwksResolver,
      rawTokenVerifier:    mockRawTokenVerifier,
    }),
    principalFactory: createPrincipalFactory({
      internalIssuer:   'https://api.voya.test',
      internalAudience: 'voya-internal',
      sessionTtlSeconds: 3600,
      clock:       () => BASE_NOW,
      idGenerator: () => 'test-session-id',
    }),
    challengeRepository: cr,
    profileRepository:   pr,
    clock:       () => BASE_NOW,
    idGenerator: () => 'test-correlation-id',
    logger: {
      info:  () => {},
      warn:  () => {},
      error: () => {},
    },
    challengeRepo: cr,
    profileRepo:   pr,
  };
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('authFlow integration — callback route', () => {
  let challengeRepo: FakeChallengeRepository;
  let profileRepo:   FakeProfileRepository;

  beforeEach(() => {
    challengeRepo = new FakeChallengeRepository();
    profileRepo   = new FakeProfileRepository();
  });

  it('returns 200 with PrincipalSummary on successful Platinum login', async () => {
    const stateHash = sha256Hex(FIXED_STATE);
    const nonceHash = validPlatinumClaims.nonce; // fixture: token.nonce === nonceHash
    challengeRepo.seed(stateHash, nonceHash, 'pkce-hash', 'corr-001');

    const deps    = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    const handler = createBonvoyCallbackRoute(deps);
    const req     = mockReq({ code: validPlatinumToken, state: FIXED_STATE });
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body['tier']).toBe(BonvoyMemberTier.PLATINUM);
    expect(body['isNewProfile']).toBe(true);
    expect(body['sessionId']).toBe('test-session-id');
    expect(body['travellerRef']).toMatch(/^owner_ref_test_/);
  });

  it('returns 200 with isNewProfile=false for a returning traveller', async () => {
    const stateHash  = sha256Hex(FIXED_STATE);
    const nonceHash  = validPlatinumClaims.nonce;
    const subHash    = sha256Hex(validPlatinumClaims.sub);
    const travellerRef = 'owner_ref_returning_001';
    // Pre-seed existing profile
    profileRepo['profiles'].set(subHash, { travellerRef });
    challengeRepo.seed(stateHash, nonceHash, 'pkce-hash', 'corr-002');

    const deps    = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    const handler = createBonvoyCallbackRoute(deps);
    const req     = mockReq({ code: validPlatinumToken, state: FIXED_STATE });
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body['isNewProfile']).toBe(false);
    expect(body['travellerRef']).toBe(travellerRef);
  });

  it('returns 409 AUTH_REPLAY_DETECTED for replayed callback (already consumed)', async () => {
    const stateHash = sha256Hex(FIXED_STATE);
    challengeRepo.seedConsumed(stateHash); // already consumed

    const deps    = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    const handler = createBonvoyCallbackRoute(deps);
    const req     = mockReq({ code: validPlatinumToken, state: FIXED_STATE });
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe(AuthErrorCode.AUTH_REPLAY_DETECTED);
  });

  it('returns 409 AUTH_REPLAY_DETECTED when challenge does not exist', async () => {
    // No challenge seeded for this state
    const deps    = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    const handler = createBonvoyCallbackRoute(deps);
    const req     = mockReq({ code: validPlatinumToken, state: 'no-such-state' });
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe(AuthErrorCode.AUTH_REPLAY_DETECTED);
  });

  it('returns 401 AUTH_WRONG_AUDIENCE for token with unexpected audience', async () => {
    const stateHash = sha256Hex(FIXED_STATE);
    const nonceHash = wrongAudienceClaims.nonce;
    challengeRepo.seed(stateHash, nonceHash, 'pkce-hash', 'corr-003');

    const deps    = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    const handler = createBonvoyCallbackRoute(deps);
    const req     = mockReq({ code: wrongAudienceToken, state: FIXED_STATE });
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe(AuthErrorCode.AUTH_WRONG_AUDIENCE);
  });

  it('returns 401 AUTH_TOKEN_EXPIRED for an expired token', async () => {
    const stateHash = sha256Hex(FIXED_STATE);
    const nonceHash = expiredClaims.nonce;
    challengeRepo.seed(stateHash, nonceHash, 'pkce-hash', 'corr-004');

    // Clock is far in the future so token is expired
    const deps = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    // Override clock on oidcVerifier to be past expiry
    const verifier = createOidcVerifier({
      issuer:              MOCK_BONVOY_ISSUER,
      audience:            MOCK_BONVOY_CLIENT_ID,
      maxClockSkewSeconds: 30,
      clock:               () => BASE_NOW + 7200, // well past expiredClaims.exp
      jwksResolver:        mockJwksResolver,
      rawTokenVerifier:    mockRawTokenVerifier,
    });
    const depsWithExpiredClock = { ...deps, oidcVerifier: verifier };
    const handler = createBonvoyCallbackRoute(depsWithExpiredClock);
    const req     = mockReq({ code: expiredToken, state: FIXED_STATE });
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe(AuthErrorCode.AUTH_TOKEN_EXPIRED);
  });

  it('returns 403 AUTH_TIER_MISSING when verified_tier is absent', async () => {
    const noTierClaims = validMemberNoTierClaims as typeof validPlatinumClaims;
    const stateHash = sha256Hex(FIXED_STATE);
    const nonceHash = noTierClaims.nonce;
    challengeRepo.seed(stateHash, nonceHash, 'pkce-hash', 'corr-005');

    // Mock verifier that returns claims without verified_tier
    const noTierRawVerifier = (_t: string, _j: unknown) =>
      Promise.resolve(noTierClaims as Record<string, unknown>);
    const deps    = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    const verifier = createOidcVerifier({
      issuer:              MOCK_BONVOY_ISSUER,
      audience:            MOCK_BONVOY_CLIENT_ID,
      maxClockSkewSeconds: 30,
      clock:               () => BASE_NOW + 1,
      jwksResolver:        mockJwksResolver,
      rawTokenVerifier:    noTierRawVerifier,
    });
    const depsWithNoTier = { ...deps, oidcVerifier: verifier };
    const handler = createBonvoyCallbackRoute(depsWithNoTier);
    const req     = mockReq({ code: 'any-token', state: FIXED_STATE });
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(403);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe(AuthErrorCode.AUTH_TIER_MISSING);
  });

  it('returns 502 AUTH_PROVIDER_UNAVAILABLE when JWKS endpoint fails', async () => {
    const stateHash = sha256Hex(FIXED_STATE);
    const nonceHash = validPlatinumClaims.nonce;
    challengeRepo.seed(stateHash, nonceHash, 'pkce-hash', 'corr-006');

    const deps    = makeCallbackDeps(failingJwksResolver, challengeRepo, profileRepo);
    const handler = createBonvoyCallbackRoute(deps);
    const req     = mockReq({ code: validPlatinumToken, state: FIXED_STATE });
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(502);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe(AuthErrorCode.AUTH_PROVIDER_UNAVAILABLE);
  });

  it('returns 400 AUTH_MALFORMED_REQUEST for missing code field', async () => {
    const deps    = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    const handler = createBonvoyCallbackRoute(deps);
    const req     = mockReq({ state: FIXED_STATE }); // code is missing
    const res     = mockRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe(AuthErrorCode.AUTH_MALFORMED_REQUEST);
  });

  it('error responses never contain stack traces or raw token material', async () => {
    const stateHash = sha256Hex(FIXED_STATE);
    const nonceHash = validPlatinumClaims.nonce;
    challengeRepo.seedConsumed(stateHash);

    const deps    = makeCallbackDeps(undefined, challengeRepo, profileRepo);
    const handler = createBonvoyCallbackRoute(deps);
    const req     = mockReq({ code: validPlatinumToken, state: FIXED_STATE });
    const res     = mockRes();

    await handler(req as never, res as never);

    const body = res.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('token');
    expect(body).not.toHaveProperty('code_verifier');
    expect(JSON.stringify(body)).not.toContain(validPlatinumToken);
    expect(body).toHaveProperty('correlationId');
  });
});

// ---------------------------------------------------------------------------
// PKCE utility tests
// ---------------------------------------------------------------------------

describe('PKCE utilities', () => {
  it('generates unique opaque tokens on each call', () => {
    // Import tested indirectly
    const { generateOpaqueToken, generateCodeVerifier, deriveCodeChallenge, verifyPkce } =
      // @ts-ignore — dynamic import for testing
      await import('../../src/lib/pkce.js') as typeof import('../../src/lib/pkce.js');

    const v1 = generateOpaqueToken();
    const v2 = generateOpaqueToken();
    expect(v1).not.toBe(v2);
    expect(v1.length).toBe(32); // 16 bytes → 32 hex chars

    const verifier   = generateCodeVerifier();
    const challenge  = deriveCodeChallenge(verifier);
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce('wrong-verifier', challenge)).toBe(false);
  });
});
