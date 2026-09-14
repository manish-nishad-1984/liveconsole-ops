import { MODULE_PERMISSIONS } from '@liveconsole-ops/types';
import type { ModuleKey, PermissionKey } from '@liveconsole-ops/types';
import type { Request, RequestHandler } from 'express';

import { ForbiddenError, UnauthenticatedError } from '../lib/errors.js';

/**
 * Route-level authorisation.
 *
 * The rule is: every non-public route names the permission it needs, right there
 * in the router. Nothing is protected by convention or by being "an admin page" —
 * if a route has no `requirePermission`, that is visible in the router file.
 */

const actor = (req: Request) => {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth;
};

export const requirePermission =
  (...permissions: PermissionKey[]): RequestHandler =>
  (req, _res, next) => {
    try {
      const { isSuperAdmin, permissions: granted } = actor(req);
      if (isSuperAdmin) return next();

      const allowed = permissions.some((permission) => granted.has(permission));
      if (!allowed) {
        throw new ForbiddenError(`This action requires the ${permissions.join(' or ')} permission`);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };

/** Requires *all* of the listed permissions rather than any one of them. */
export const requireAllPermissions =
  (...permissions: PermissionKey[]): RequestHandler =>
  (req, _res, next) => {
    try {
      const { isSuperAdmin, permissions: granted } = actor(req);
      if (isSuperAdmin) return next();

      const missing = permissions.filter((permission) => !granted.has(permission));
      if (missing.length > 0) {
        throw new ForbiddenError(`Missing permission(s): ${missing.join(', ')}`);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };

/** Any permission on the module is enough — used for read-only shell routes. */
export const requireModuleAccess =
  (moduleKey: ModuleKey): RequestHandler =>
  (req, _res, next) => {
    try {
      const { isSuperAdmin, permissions: granted } = actor(req);
      if (isSuperAdmin) return next();

      const hasAccess = MODULE_PERMISSIONS[moduleKey].some((action) =>
        granted.has(`${moduleKey}:${action}` as PermissionKey),
      );
      if (!hasAccess) throw new ForbiddenError(`You do not have access to ${moduleKey}`);
      return next();
    } catch (error) {
      return next(error);
    }
  };

export const requireRole =
  (...slugs: string[]): RequestHandler =>
  (req, _res, next) => {
    try {
      const { isSuperAdmin, roles } = actor(req);
      if (isSuperAdmin) return next();
      if (!slugs.some((slug) => roles.includes(slug))) {
        throw new ForbiddenError('Your role does not allow this action');
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };

export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  try {
    if (!actor(req).isSuperAdmin) {
      throw new ForbiddenError('This action is restricted to super administrators');
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Convenience for controllers: does the current actor hold this permission? */
export const actorCan = (req: Request, permission: PermissionKey): boolean => {
  if (!req.auth) return false;
  return req.auth.isSuperAdmin || req.auth.permissions.has(permission);
};
