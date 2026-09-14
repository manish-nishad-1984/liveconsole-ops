import { AsyncLocalStorage } from 'node:async_hooks';

import type { PermissionKey } from '@liveconsole-ops/types';

/**
 * Per-request ambient context.
 *
 * The audit trail needs to know *who* made a change and under which request, but
 * threading `actorId` through every service and repository signature would put
 * plumbing into every business method. An AsyncLocalStorage store keeps the call
 * sites clean while remaining safe under concurrency — each request gets its own
 * store, and async continuations inherit it automatically.
 */

export interface RequestContext {
  requestId: string;
  actorId: string | null;
  actorEmail: string | null;
  /** Tenant of the signed-in actor. Null on unauthenticated requests. */
  organizationId: string | null;
  /**
   * What the actor may do, carried alongside the id for the same reason the id
   * is: a service that must narrow a list to the caller's own records otherwise
   * needs a permission set threaded through every signature between the router
   * and the mapper. The router still guards the route — this is for the
   * decisions *inside* a permitted request.
   */
  permissions: ReadonlySet<PermissionKey>;
  isSuperAdmin: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(context: RequestContext, callback: () => T): T =>
  storage.run(context, callback);

export const getContext = (): RequestContext | undefined => storage.getStore();

export const getActorId = (): string | null => storage.getStore()?.actorId ?? null;

/**
 * Tenant of the current request.
 *
 * This is the multi-tenancy boundary. It is set from `user.organizationId` on the
 * live account row and from nowhere else — never a header, a query param or a
 * request body.
 */
export const getOrganizationId = (): string | null =>
  storage.getStore()?.organizationId ?? null;

export const getRequestId = (): string | null => storage.getStore()?.requestId ?? null;

/**
 * Whether the current actor holds a permission.
 *
 * Super admin short-circuits, exactly as it does in `requirePermission` — the two
 * must never disagree about what somebody may do. An unauthenticated context
 * holds nothing, so an internal caller with no request behind it gets the
 * narrowest answer rather than the widest.
 */
export const actorCan = (permission: PermissionKey): boolean => {
  const context = storage.getStore();
  if (!context) return false;
  return context.isSuperAdmin || context.permissions.has(permission);
};

/** Called by the auth middleware once the token has been verified. */
export const setContextActor = (
  actorId: string,
  actorEmail: string,
  organizationId: string,
  permissions: ReadonlySet<PermissionKey> = new Set(),
  isSuperAdmin = false,
): void => {
  const context = storage.getStore();
  if (context) {
    context.actorId = actorId;
    context.actorEmail = actorEmail;
    context.organizationId = organizationId;
    context.permissions = permissions;
    context.isSuperAdmin = isSuperAdmin;
  }
};

/** Audit columns for a create, filled from ambient context. */
export const auditCreate = (): { createdById: string | null; updatedById: string | null } => {
  const actorId = getActorId();
  return { createdById: actorId, updatedById: actorId };
};

/** Audit column for an update. */
export const auditUpdate = (): { updatedById: string | null } => ({ updatedById: getActorId() });

/** Tenant of the request, or a hard failure — for services that must not guess. */
export const requireOrg = (): string => {
  const organizationId = getOrganizationId();
  if (!organizationId) {
    throw new Error('No organisation on the current request context');
  }
  return organizationId;
};
