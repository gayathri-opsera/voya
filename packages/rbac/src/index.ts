/**
 * RBAC Package — WO-014: Deny-by-default RBAC with ownership predicate enforcement.
 *
 * Permission model:
 * - Resources: booking, payment, itinerary, user, admin
 * - Actions: read, create, update, delete, cancel, override, read_pii
 * - Ownership predicates: the "own" qualifier restricts to owned resources
 *
 * Design:
 * - DENY BY DEFAULT: if no rule matches, access is denied
 * - Role definitions are the single source of truth
 * - Ownership predicates evaluated at call site (need the actual resource owner)
 */

export type RbacResource =
  | "booking"
  | "payment"
  | "itinerary"
  | "user"
  | "session"
  | "audit_log"
  | "admin";

export type RbacAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "cancel"
  | "override"
  | "read_pii"
  | "list";

export type RbacRole = "traveler" | "support_agent" | "ops" | "system" | "admin";

export interface Permission {
  resource: RbacResource;
  action: RbacAction;
  ownOnly: boolean; // true = only for resources owned by the actor
}

export const ROLE_PERMISSIONS: Readonly<Record<RbacRole, readonly Permission[]>> = {
  traveler: [
    { resource: "booking", action: "read", ownOnly: true },
    { resource: "booking", action: "create", ownOnly: false },
    { resource: "booking", action: "cancel", ownOnly: true },
    { resource: "payment", action: "read", ownOnly: true },
    { resource: "itinerary", action: "read", ownOnly: true },
    { resource: "itinerary", action: "create", ownOnly: false },
    { resource: "itinerary", action: "update", ownOnly: true },
    { resource: "itinerary", action: "delete", ownOnly: true },
    { resource: "user", action: "read", ownOnly: true },
    { resource: "user", action: "update", ownOnly: true },
    { resource: "session", action: "read", ownOnly: true },
    { resource: "session", action: "delete", ownOnly: true },
  ],
  support_agent: [
    { resource: "booking", action: "read", ownOnly: false },
    { resource: "booking", action: "cancel", ownOnly: false },
    { resource: "booking", action: "list", ownOnly: false },
    { resource: "payment", action: "read", ownOnly: false },
    { resource: "itinerary", action: "read", ownOnly: false },
    { resource: "user", action: "read", ownOnly: false },
    { resource: "audit_log", action: "read", ownOnly: false },
  ],
  ops: [
    { resource: "booking", action: "read", ownOnly: false },
    { resource: "booking", action: "cancel", ownOnly: false },
    { resource: "booking", action: "override", ownOnly: false },
    { resource: "booking", action: "list", ownOnly: false },
    { resource: "payment", action: "read", ownOnly: false },
    { resource: "payment", action: "override", ownOnly: false },
    { resource: "itinerary", action: "read", ownOnly: false },
    { resource: "itinerary", action: "delete", ownOnly: false },
    { resource: "user", action: "read", ownOnly: false },
    { resource: "user", action: "read_pii", ownOnly: false },
    { resource: "audit_log", action: "read", ownOnly: false },
    { resource: "session", action: "delete", ownOnly: false },
  ],
  admin: [
    { resource: "booking", action: "read", ownOnly: false },
    { resource: "booking", action: "cancel", ownOnly: false },
    { resource: "booking", action: "override", ownOnly: false },
    { resource: "booking", action: "list", ownOnly: false },
    { resource: "payment", action: "read", ownOnly: false },
    { resource: "payment", action: "override", ownOnly: false },
    { resource: "itinerary", action: "read", ownOnly: false },
    { resource: "itinerary", action: "delete", ownOnly: false },
    { resource: "user", action: "read", ownOnly: false },
    { resource: "user", action: "read_pii", ownOnly: false },
    { resource: "user", action: "delete", ownOnly: false },
    { resource: "audit_log", action: "read", ownOnly: false },
    { resource: "session", action: "delete", ownOnly: false },
    { resource: "admin", action: "read", ownOnly: false },
    { resource: "admin", action: "update", ownOnly: false },
  ],
  system: [
    // System role has all permissions (internal service-to-service calls)
    { resource: "booking", action: "read", ownOnly: false },
    { resource: "booking", action: "create", ownOnly: false },
    { resource: "booking", action: "update", ownOnly: false },
    { resource: "booking", action: "cancel", ownOnly: false },
    { resource: "booking", action: "override", ownOnly: false },
    { resource: "payment", action: "read", ownOnly: false },
    { resource: "payment", action: "create", ownOnly: false },
    { resource: "payment", action: "override", ownOnly: false },
    { resource: "audit_log", action: "read", ownOnly: false },
    { resource: "user", action: "read", ownOnly: false },
    { resource: "user", action: "read_pii", ownOnly: false },
    { resource: "session", action: "delete", ownOnly: false },
  ],
};

export interface AuthorizationContext {
  actorId: string;
  actorRole: RbacRole;
  resourceOwnerId?: string;
}

export class AccessDeniedError extends Error {
  constructor(
    public readonly actorId: string,
    public readonly actorRole: RbacRole,
    public readonly resource: RbacResource,
    public readonly action: RbacAction,
  ) {
    super(
      `Actor ${actorId} (${actorRole}) is not permitted to ${action} on ${resource}`,
    );
    this.name = "AccessDeniedError";
  }
}

/**
 * Returns true iff the actor may perform the action on the resource.
 * Deny-by-default: returns false if no matching permission is found.
 */
export function isPermitted(
  ctx: AuthorizationContext,
  resource: RbacResource,
  action: RbacAction,
): boolean {
  const permissions = ROLE_PERMISSIONS[ctx.actorRole];
  if (!permissions) return false;

  for (const perm of permissions) {
    if (perm.resource !== resource || perm.action !== action) continue;
    if (!perm.ownOnly) return true;
    // ownOnly: require ownership match
    if (ctx.resourceOwnerId && ctx.actorId === ctx.resourceOwnerId) return true;
  }

  return false;
}

/** Throws AccessDeniedError if the actor is not permitted. */
export function assertPermitted(
  ctx: AuthorizationContext,
  resource: RbacResource,
  action: RbacAction,
): void {
  if (!isPermitted(ctx, resource, action)) {
    throw new AccessDeniedError(ctx.actorId, ctx.actorRole, resource, action);
  }
}
