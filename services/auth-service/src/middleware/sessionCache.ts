/**
 * Short-TTL in-process session validity cache.
 *
 * - Cache miss → one DB query; hit → zero queries.
 * - Explicit invalidate() called on logout/revocation paths so the issuing
 *   node sees revocation immediately. Other nodes see it after TTL elapses.
 * - Documented eventual-consistency window for multi-instance: up to TTL_MS.
 */

export interface CachedSession {
  userId: string;
  userStatus: string;
  roles: string[];
  permissions: string[];
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionCacheEntry {
  data: CachedSession;
  cachedAt: number;
}

const DEFAULT_TTL_MS = 30_000; // 30 seconds

export class SessionCache {
  private readonly cache = new Map<string, SessionCacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(sessionId: string): CachedSession | null {
    const entry = this.cache.get(sessionId);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(sessionId);
      return null;
    }
    return entry.data;
  }

  set(sessionId: string, data: CachedSession): void {
    this.cache.set(sessionId, { data, cachedAt: Date.now() });
  }

  /** Immediately remove a session from the cache (called on revocation). */
  invalidate(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  /** For testing: forcibly expire an entry by backdating its cachedAt. */
  _expireForTest(sessionId: string): void {
    const entry = this.cache.get(sessionId);
    if (entry) {
      entry.cachedAt = Date.now() - this.ttlMs - 1;
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

export const globalSessionCache = new SessionCache();
