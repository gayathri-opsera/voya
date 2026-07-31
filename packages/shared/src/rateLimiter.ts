/**
 * RateLimiter — WO-016: Tiered rate limiting with Retry-After headers.
 *
 * Implements a sliding window rate limiter with per-tier limits:
 * - anonymous: 30 req/min
 * - authenticated: 120 req/min
 * - service-to-service: 1000 req/min (no rate limit)
 *
 * On limit exceeded: returns 429 with Retry-After header.
 */

export type RateLimitTier = "anonymous" | "authenticated" | "service";

export interface RateLimitConfig {
  tier: RateLimitTier;
  windowMs: number;
  maxRequests: number;
}

export const DEFAULT_RATE_LIMITS: Record<RateLimitTier, RateLimitConfig> = {
  anonymous: { tier: "anonymous", windowMs: 60_000, maxRequests: 30 },
  authenticated: { tier: "authenticated", windowMs: 60_000, maxRequests: 120 },
  service: { tier: "service", windowMs: 60_000, maxRequests: Infinity },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  retryAfterSec?: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAtMs: number }>;
}

/** In-memory store for testing (single-process only). */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { count: number; resetAtMs: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAtMs: number }> {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || now >= existing.resetAtMs) {
      const resetAtMs = now + windowMs;
      this.windows.set(key, { count: 1, resetAtMs });
      return { count: 1, resetAtMs };
    }

    existing.count++;
    return { count: existing.count, resetAtMs: existing.resetAtMs };
  }
}

export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly configs: Record<RateLimitTier, RateLimitConfig> = DEFAULT_RATE_LIMITS,
  ) {}

  async check(key: string, tier: RateLimitTier): Promise<RateLimitResult> {
    const config = this.configs[tier];

    if (config.maxRequests === Infinity) {
      return { allowed: true, remaining: Infinity, resetAtMs: Date.now() + config.windowMs };
    }

    const { count, resetAtMs } = await this.store.increment(key, config.windowMs);
    const remaining = Math.max(0, config.maxRequests - count);
    const allowed = count <= config.maxRequests;

    return {
      allowed,
      remaining,
      resetAtMs,
      retryAfterSec: allowed ? undefined : Math.ceil((resetAtMs - Date.now()) / 1000),
    };
  }
}
