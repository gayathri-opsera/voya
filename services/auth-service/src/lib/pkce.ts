/**
 * PKCE (Proof Key for Code Exchange) utilities — RFC 7636.
 *
 * Uses Node.js built-in crypto. No external dependencies.
 * All functions are pure and synchronous except generateCodeVerifier
 * which uses crypto.randomBytes.
 */

import { createHash, randomBytes } from 'node:crypto';

/** Generate a cryptographically random PKCE code verifier (43 base64url chars). */
export function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Derive the S256 code challenge from a code verifier: BASE64URL(SHA256(verifier)). */
export function deriveCodeChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Verify a PKCE code verifier against a stored code challenge (S256 method).
 * Returns true if deriveCodeChallenge(verifier) === challenge.
 */
export function verifyPkce(verifier: string, challenge: string): boolean {
  return deriveCodeChallenge(verifier) === challenge;
}

/**
 * Produce a SHA-256 hex digest of a value.
 * Used for hashing state, nonce, and code verifier before storage.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Generate a cryptographically random opaque state or nonce value (32 hex chars). */
export function generateOpaqueToken(): string {
  return randomBytes(16).toString('hex');
}
