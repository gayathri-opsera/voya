/**
 * Public route allow-list — routes that do NOT require authentication.
 * Entries are matched as exact `method:path` strings.
 *
 * Any route not in this list that lacks an authentication guard will cause
 * the route-coverage test to fail.
 */
export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  "POST:/auth/register",
  "POST:/auth/verify-email",
  "POST:/auth/resend-verification",
  "POST:/auth/login",
  "POST:/auth/refresh",
  "POST:/auth/forgot-password",
  "POST:/auth/reset-password",
  "GET:/health",
  "GET:/ready",
]);
