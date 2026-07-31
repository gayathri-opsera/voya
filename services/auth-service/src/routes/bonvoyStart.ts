/**
 * GET /v1/auth/bonvoy/start
 *
 * Initiates the Bonvoy OIDC Authorization Code with PKCE flow:
 *   1. Validates optional returnTo query param
 *   2. Generates state, nonce, PKCE code verifier + code challenge
 *   3. Hashes state, nonce, and code verifier for server-side storage
 *   4. Persists the OidcLoginChallenge row
 *   5. Returns 302 → Bonvoy authorization URL
 *
 * Raw state, nonce, and code verifier values are NEVER logged or persisted;
 * only their SHA-256 hashes are stored.
 */

import type { Request, Response } from 'express';
import { AuthStartRequestSchema, AuthErrorCode } from '@voya/contracts';
import type { AuthServiceDeps } from '../types.js';
import {
  generateOpaqueToken,
  generateCodeVerifier,
  deriveCodeChallenge,
  sha256Hex,
} from '../lib/pkce.js';
import { generateCorrelationId } from '../lib/correlationId.js';

const CHALLENGE_TTL_SECONDS = 600; // 10 minutes

export function createBonvoyStartRoute(deps: AuthServiceDeps) {
  return async function bonvoyStartHandler(req: Request, res: Response): Promise<void> {
    const correlationId = generateCorrelationId();

    // Parse and validate query params
    const parsed = AuthStartRequestSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        code:          AuthErrorCode.AUTH_MALFORMED_REQUEST,
        message:       'Invalid query parameters for auth start',
        correlationId,
        details:       parsed.error.issues.map(i => ({ field: i.path.join('/'), message: i.message })),
      });
      return;
    }

    const { returnTo } = parsed.data;

    // Generate PKCE, state, nonce
    const state        = generateOpaqueToken();
    const nonce        = generateOpaqueToken();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = deriveCodeChallenge(codeVerifier);

    // Hash for storage — raw values are ephemeral
    const stateHash        = sha256Hex(state);
    const nonceHash        = sha256Hex(nonce);
    const pkceVerifierHash = sha256Hex(codeVerifier);

    const expiresAt = new Date((deps.clock() + CHALLENGE_TTL_SECONDS) * 1000);

    // Persist challenge
    try {
      await deps.challengeRepository.createChallenge({
        stateHash,
        nonceHash,
        pkceVerifierHash,
        expiresAt,
        correlationId,
      });
    } catch {
      deps.logger.error('Failed to persist login challenge', {
        correlationId,
        operation: 'bonvoy_start',
        outcome:   'challenge_store_error',
      });
      res.status(500).json({
        code:          'INTERNAL_ERROR',
        message:       'Failed to initiate authentication session',
        correlationId,
      });
      return;
    }

    deps.logger.info('Bonvoy OIDC start initiated', {
      correlationId,
      operation: 'bonvoy_start',
      outcome:   'challenge_stored',
      provider:  'bonvoy',
    });

    // Build Bonvoy authorization URL
    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             deps.bonvoyClientId,
      redirect_uri:          deps.bonvoyRedirectUri,
      scope:                 'openid',
      state,
      nonce,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
      ...(returnTo ? { returnTo } : {}),
    });

    res.redirect(302, `${deps.bonvoyAuthUrl}?${params.toString()}`);
  };
}
