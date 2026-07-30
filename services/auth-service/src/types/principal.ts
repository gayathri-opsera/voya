/**
 * Request principal — typed identity attached to every authenticated request.
 */

export interface RequestPrincipal {
  userId: string;
  sessionId: string;
  tokenId: string;
  roles: Set<string>;
  permissions: Set<string>;
  userStatus: string;
}

// ─── Express request augmentation ─────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Present on authenticated routes; undefined on public / optionalAuth (no token) */
      principal?: RequestPrincipal;
    }
  }
}
