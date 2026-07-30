/**
 * Authentication middleware for Express.
 *
 * Produces a typed `RequestPrincipal` attached as `req.principal`.
 * Checks:
 *   1. Authorization header is well-formed (Bearer scheme)
 *   2. JWT signature, expiry, issuer, audience, kid are valid
 *   3. Session referenced by `sid` claim is active (cache → DB)
 *   4. User account is active (not suspended/deleted)
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { TokenService } from "../services/jwtService.js";
import type { DbClient } from "../db/types.js";
import { SessionCache, globalSessionCache, type CachedSession } from "./sessionCache.js";

export { SessionCache };

// Re-export for route convenience
export { globalSessionCache };

// ─── Header parsing ───────────────────────────────────────────────────────────

/** Returns the raw Bearer token string, or null if malformed. */
export function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2) return null;
  if (parts[0]!.toLowerCase() !== "bearer") return null;
  const token = parts[1]!;
  if (!token) return null;
  return token;
}

// ─── Error helpers ────────────────────────────────────────────────────────────

function unauthorized(res: Response, code: string): void {
  res.setHeader("WWW-Authenticate", `Bearer error="${code}"`);
  res.status(401).json({ error: { code } });
}

function forbidden(res: Response, code: string, extra?: Record<string, unknown>): void {
  res.status(403).json({ error: { code, ...extra } });
}

// ─── Session resolver ─────────────────────────────────────────────────────────

async function resolveSession(
  sessionId: string,
  db: DbClient,
  cache: SessionCache,
): Promise<CachedSession | null> {
  const cached = cache.get(sessionId);
  if (cached) return cached;

  const row = await db.session.findUnique({ where: { id: sessionId } });
  if (!row) return null;

  const user = await db.user.findUnique({ where: { id: row.userId } });
  if (!user) return null;

  const data: CachedSession = {
    userId: row.userId,
    userStatus: user.status,
    roles: [],       // Will be extended when RBAC is fully wired (WO-022)
    permissions: [],
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };

  cache.set(sessionId, data);
  return data;
}

// ─── Middleware factory ───────────────────────────────────────────────────────

export interface AuthMiddlewareOptions {
  tokenService: TokenService;
  db: DbClient;
  cache?: SessionCache;
}

/**
 * `authenticate` — attaches a verified principal or rejects with 401/403.
 * Use for protected routes.
 */
export function createAuthMiddleware(opts: AuthMiddlewareOptions): RequestHandler {
  const cache = opts.cache ?? globalSessionCache;

  return async function authenticate(req: Request, res: Response, next: NextFunction) {
    const rawToken = parseBearerToken(req.headers.authorization);
    if (!rawToken) {
      unauthorized(res, "unauthenticated");
      return;
    }

    const result = opts.tokenService.verify(rawToken);
    if (!result.ok) {
      const code = result.reason === "expired" ? "invalid_token" : "invalid_token";
      unauthorized(res, code);
      return;
    }

    const { claims } = result;
    if (!claims.sid) {
      unauthorized(res, "invalid_token");
      return;
    }

    const session = await resolveSession(claims.sid, opts.db, cache);
    if (!session) {
      unauthorized(res, "session_revoked");
      return;
    }
    if (session.revokedAt !== null) {
      cache.invalidate(claims.sid);
      unauthorized(res, "session_revoked");
      return;
    }
    if (session.expiresAt < new Date()) {
      cache.invalidate(claims.sid);
      unauthorized(res, "session_revoked");
      return;
    }
    if (session.userStatus !== "active") {
      forbidden(res, "account_disabled");
      return;
    }

    req.principal = {
      userId: claims.sub,
      sessionId: claims.sid,
      tokenId: claims.jti,
      roles: new Set([...claims.roles, ...session.roles]),
      permissions: new Set(session.permissions),
      userStatus: session.userStatus,
    };

    next();
  };
}

/**
 * `optionalAuth` — attaches principal when a valid token is present;
 * continues anonymously when the header is absent;
 * rejects with 401 if a token IS present but invalid.
 */
export function createOptionalAuthMiddleware(opts: AuthMiddlewareOptions): RequestHandler {
  const cache = opts.cache ?? globalSessionCache;

  return async function optionalAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // No token — anonymous, continue
      next();
      return;
    }

    // Token present but malformed → 401
    const rawToken = parseBearerToken(authHeader);
    if (!rawToken) {
      unauthorized(res, "unauthenticated");
      return;
    }

    const result = opts.tokenService.verify(rawToken);
    if (!result.ok) {
      unauthorized(res, "invalid_token");
      return;
    }

    const { claims } = result;
    if (!claims.sid) {
      unauthorized(res, "invalid_token");
      return;
    }

    const session = await resolveSession(claims.sid, opts.db, cache);
    if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
      unauthorized(res, "session_revoked");
      return;
    }
    if (session.userStatus !== "active") {
      forbidden(res, "account_disabled");
      return;
    }

    req.principal = {
      userId: claims.sub,
      sessionId: claims.sid,
      tokenId: claims.jti,
      roles: new Set([...claims.roles, ...session.roles]),
      permissions: new Set(session.permissions),
      userStatus: session.userStatus,
    };

    next();
  };
}

// ─── Guard factories ──────────────────────────────────────────────────────────

/** `requireAuth` — ensures `req.principal` is set (use AFTER `authenticate`). */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.principal) {
    unauthorized(res, "unauthenticated");
    return;
  }
  next();
};

/** `requireRoles(...roles)` — requires the principal to have ALL listed roles. */
export function requireRoles(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.principal) {
      unauthorized(res, "unauthenticated");
      return;
    }
    const missing = roles.filter((r) => !req.principal!.roles.has(r));
    if (missing.length > 0) {
      forbidden(res, "insufficient_permissions", { required: roles });
      return;
    }
    next();
  };
}

/** `requirePermissions(...perms)` — requires the principal to have ALL listed permissions. */
export function requirePermissions(...perms: string[]): RequestHandler {
  if (perms.length === 0) {
    throw new Error("requirePermissions called with empty list — configuration error");
  }
  return (req, res, next) => {
    if (!req.principal) {
      unauthorized(res, "unauthenticated");
      return;
    }
    const missing = perms.filter((p) => !req.principal!.permissions.has(p));
    if (missing.length > 0) {
      forbidden(res, "insufficient_permissions", { required: perms });
      return;
    }
    next();
  };
}
