/**
 * JWT token service — signs and verifies access tokens.
 *
 * Security properties:
 * - Explicit algorithm allow-list; `none` and symmetric downgrades are rejected.
 * - kid header enables zero-downtime key rotation (new key issued, old key kept
 *   in registry until all live tokens expire).
 * - jti included for future denylist support.
 * - All signing material comes from config; never from the repository.
 */

import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "crypto";

export type SupportedAlgorithm = "RS256" | "ES256" | "HS256";

const ALLOWED_ALGORITHMS: SupportedAlgorithm[] = ["RS256", "ES256", "HS256"];

export interface JwtKeyEntry {
  kid: string;
  privateKey: string;  // PEM (RS256/ES256) or base64-encoded secret (HS256)
  publicKey: string;   // PEM (RS256/ES256) or same as privateKey (HS256)
  algorithm: SupportedAlgorithm;
}

export interface TokenConfig {
  /** Active signing key */
  signingKey: JwtKeyEntry;
  /** Additional keys for verification (rotation overlap) */
  verificationKeys?: JwtKeyEntry[];
  issuer: string;
  audience: string;
  /** Access token TTL in seconds (default 900) */
  expiresInSeconds?: number;
  /** Accepted clock skew in seconds (default 5) */
  clockSkewSeconds?: number;
}

export interface AccessTokenClaims {
  sub: string;       // user id
  sid: string;       // session id
  iss: string;
  aud: string | string[];
  iat: number;
  exp: number;
  jti: string;
  roles: string[];
}

export interface MintTokenInput {
  userId: string;
  sessionId: string;
  roles: string[];
}

export interface VerifyTokenResult {
  ok: true;
  claims: AccessTokenClaims;
}
export interface VerifyTokenError {
  ok: false;
  reason: "expired" | "invalid_signature" | "invalid_algorithm" | "unknown_kid" | "invalid_claims";
}
export type VerifyTokenOutcome = VerifyTokenResult | VerifyTokenError;

export class TokenService {
  private readonly allVerificationKeys: JwtKeyEntry[];

  constructor(private readonly config: TokenConfig) {
    this.allVerificationKeys = [
      config.signingKey,
      ...(config.verificationKeys ?? []),
    ];
  }

  mint(input: MintTokenInput): { token: string; expiresIn: number } {
    const { signingKey, issuer, audience } = this.config;
    const expiresIn = this.config.expiresInSeconds ?? 900;

    const payload: Omit<AccessTokenClaims, "iat" | "exp"> = {
      sub: input.userId,
      sid: input.sessionId,
      iss: issuer,
      aud: audience,
      jti: randomBytes(16).toString("hex"),
      roles: input.roles,
    };

    const token = jwt.sign(payload, signingKey.privateKey, {
      algorithm: signingKey.algorithm as jwt.Algorithm,
      expiresIn,
      keyid: signingKey.kid,
    } as jwt.SignOptions);

    return { token, expiresIn };
  }

  verify(token: string): VerifyTokenOutcome {
    const { issuer, audience, clockSkewSeconds = 5 } = this.config;

    // Decode header to select the right key
    let decodedHeader: jwt.JwtHeader | undefined;
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === "string") {
        return { ok: false, reason: "invalid_claims" };
      }
      decodedHeader = decoded.header;
    } catch {
      return { ok: false, reason: "invalid_claims" };
    }

    // Reject none algorithm at the header level before any verification
    const headerAlg = decodedHeader?.alg;
    if (!headerAlg || !ALLOWED_ALGORITHMS.includes(headerAlg as SupportedAlgorithm)) {
      return { ok: false, reason: "invalid_algorithm" };
    }

    // Find the key matching the kid (if present)
    const kid = decodedHeader?.kid;
    const candidateKeys = kid
      ? this.allVerificationKeys.filter((k) => k.kid === kid)
      : this.allVerificationKeys;

    if (candidateKeys.length === 0) {
      return { ok: false, reason: "unknown_kid" };
    }

    for (const key of candidateKeys) {
      // Reject if token algorithm doesn't match the key's algorithm
      if (headerAlg !== key.algorithm) {
        continue;
      }

      try {
        const claims = jwt.verify(token, key.publicKey, {
          algorithms: [key.algorithm as jwt.Algorithm],
          issuer,
          audience,
          clockTolerance: clockSkewSeconds,
        }) as AccessTokenClaims;

        return { ok: true, claims };
      } catch (err: unknown) {
        if (err instanceof jwt.TokenExpiredError) {
          return { ok: false, reason: "expired" };
        }
        // Try next key on signature failure
      }
    }

    return { ok: false, reason: "invalid_signature" };
  }
}

// ─── Test helper: generate an in-memory HMAC key ─────────────────────────────

export function createHmacKey(secret?: string): JwtKeyEntry {
  const s = secret ?? randomBytes(32).toString("base64");
  return { kid: randomUUID(), privateKey: s, publicKey: s, algorithm: "HS256" };
}
