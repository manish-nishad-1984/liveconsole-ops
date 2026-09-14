import type { PermissionKey } from '@liveconsole-ops/types';
import type { RequestHandler } from 'express';

import { UnauthenticatedError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { setContextActor } from '../lib/requestContext.js';

const extractBearer = (header: string | undefined): string | null => {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};

/**
 * Verifies the access token, then loads the live account.
 *
 * Permissions are read from the database on every request rather than trusted
 * from the token: a role change or a suspension must take effect immediately, not
 * whenever the 15-minute access token happens to expire. `tokenVersion` gives the
 * same immediacy for forced sign-out — bump it anywhere and every outstanding
 * access token dies at once, with no blacklist to maintain.
 *
 * The token is trusted for identity (`sub`) and nothing else. In particular
 * `organizationId` always comes from this lookup: it is the multi-tenancy
 * boundary and must never be accepted from a header, query param or body.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractBearer(req.headers.authorization);
    if (!token) throw new UnauthenticatedError('Authorization header missing or malformed');

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        organizationId: true,
        email: true,
        status: true,
        isActive: true,
        deletedAt: true,
        isSuperAdmin: true,
        tokenVersion: true,
        roles: {
          where: { role: { isActive: true } },
          select: {
            role: {
              select: {
                slug: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user || user.deletedAt) throw new UnauthenticatedError('Account no longer exists');
    if (!user.isActive || user.status === 'DISABLED') {
      throw new UnauthenticatedError('This account has been disabled');
    }
    if (user.status === 'SUSPENDED') {
      throw new UnauthenticatedError('This account is suspended');
    }
    if (user.tokenVersion !== payload.tv) {
      throw new UnauthenticatedError('Session is no longer valid, please sign in again');
    }

    const permissions = new Set<PermissionKey>();
    const roles: string[] = [];

    for (const { role } of user.roles) {
      roles.push(role.slug);
      for (const { permission } of role.permissions) {
        permissions.add(permission.key as PermissionKey);
      }
    }

    req.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      roles,
      permissions,
      tokenVersion: user.tokenVersion,
    };

    setContextActor(user.id, user.email, user.organizationId, permissions, user.isSuperAdmin);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Populates `req.auth` when a valid token is present, but never rejects — for
 * endpoints that behave differently for signed-in users without requiring one.
 * An invalid or expired token is treated the same as no token at all.
 */
export const optionalAuthenticate: RequestHandler = (req, res, next) => {
  if (!extractBearer(req.headers.authorization)) {
    next();
    return;
  }

  void authenticate(req, res, () => {
    // Swallow the auth error deliberately: the route does not require identity.
    next();
  });
};
