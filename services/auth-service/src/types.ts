/**
 * Auth service — shared dependency interfaces.
 *
 * Framework-independent contracts for the repositories and services that the
 * HTTP routes depend on. Use these interfaces in tests to supply in-memory fakes.
 */

import type { OidcVerifier } from './domain/oidcVerifier.js';
import type { PrincipalFactory } from './domain/principalFactory.js';

// ---------------------------------------------------------------------------
// ChallengeRepository
// Stores and consumes short-lived OidcLoginChallenge rows.
// ---------------------------------------------------------------------------

export interface StoredChallenge {
  readonly nonceHash:        string;
  readonly pkceVerifierHash: string;
  readonly correlationId:    string;
}

export interface ChallengeRepository {
  /**
   * Persist a new login challenge.
   * Throws if a challenge with the same stateHash already exists.
   */
  createChallenge(params: {
    readonly stateHash:        string;
    readonly nonceHash:        string;
    readonly pkceVerifierHash: string;
    readonly expiresAt:        Date;
    readonly correlationId:    string;
  }): Promise<void>;

  /**
   * Find a challenge by stateHash AND atomically mark it consumed.
   *
   * Returns null if:
   *   - No row matches stateHash
   *   - The row has already been consumed (consumedAt is set)
   *   - The row has expired (expiresAt < now)
   */
  findAndConsumeChallenge(stateHash: string): Promise<StoredChallenge | null>;
}

// ---------------------------------------------------------------------------
// ProfileRepository
// Creates and links TravellerProfile rows via IdentityAccountLink.
// ---------------------------------------------------------------------------

export interface ProfileRepository {
  /** Look up a profile by provider + providerSubjectHash. Returns null if not found. */
  findByProviderSubjectHash(
    provider: string,
    providerSubjectHash: string,
  ): Promise<{ readonly travellerRef: string } | null>;

  /**
   * Create a new TravellerProfile + IdentityAccountLink for a first-time login.
   * Idempotent: if a link already exists for (provider, providerSubjectHash),
   * returns the existing travellerRef without creating a duplicate.
   */
  upsertProfileWithLink(params: {
    readonly provider:            string;
    readonly providerSubjectHash: string;
    readonly verifiedTier:        string;
  }): Promise<{ readonly travellerRef: string; readonly isNew: boolean }>;

  /** Update lastLoginAt and verifiedTier on an existing IdentityAccountLink. */
  updateLastLogin(params: {
    readonly provider:            string;
    readonly providerSubjectHash: string;
    readonly verifiedTier:        string;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Logger — safe structured logging interface (never log raw tokens or PII)
// ---------------------------------------------------------------------------

export interface SafeLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// AuthServiceDeps — injected into route handlers
// ---------------------------------------------------------------------------

export interface AuthServiceDeps {
  /** Bonvoy OAuth 2.0 authorization endpoint URL */
  readonly bonvoyAuthUrl:     string;
  /** Voya's registered Bonvoy client ID */
  readonly bonvoyClientId:    string;
  /** Registered redirect URI for the Bonvoy callback */
  readonly bonvoyRedirectUri: string;
  /** Bonvoy token endpoint URL (for code exchange) */
  readonly bonvoyTokenUrl:    string;
  /** OIDC ID token verifier */
  readonly oidcVerifier:      OidcVerifier;
  /** Internal principal factory */
  readonly principalFactory:  PrincipalFactory;
  /** Challenge store */
  readonly challengeRepository: ChallengeRepository;
  /** Profile store */
  readonly profileRepository:   ProfileRepository;
  /** Returns current Unix timestamp (seconds) */
  readonly clock:         () => number;
  /** Generates a unique correlation ID */
  readonly idGenerator:   () => string;
  /** Structured logger */
  readonly logger:        SafeLogger;
}
