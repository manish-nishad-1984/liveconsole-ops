import type { DashboardSummaryDto } from '@liveconsole-ops/types';

import { prisma } from '../../lib/prisma.js';
import { requireOrg } from '../../lib/requestContext.js';

/**
 * The starter dashboard.
 *
 * A boilerplate knows about exactly one thing — who has access — so that is what
 * it reports on. Replace this whole service with your domain's summary as soon as
 * there is one; the point of keeping it is that the module wiring (registry entry,
 * guard, route, page, query key) is already demonstrated end to end.
 */
export const getSummary = async (): Promise<DashboardSummaryDto> => {
  const organizationId = requireOrg();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    invitedUsers,
    suspendedUsers,
    totalRoles,
    systemRoles,
    recentActivity,
    lastSignIn,
    organization,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId, deletedAt: null } }),
    prisma.user.count({ where: { organizationId, deletedAt: null, status: 'ACTIVE' } }),
    prisma.user.count({ where: { organizationId, deletedAt: null, status: 'INVITED' } }),
    prisma.user.count({ where: { organizationId, deletedAt: null, status: 'SUSPENDED' } }),
    prisma.role.count({ where: { organizationId, deletedAt: null } }),
    prisma.role.count({ where: { organizationId, deletedAt: null, isSystem: true } }),
    prisma.auditLog.count({ where: { organizationId, createdAt: { gte: since } } }),
    prisma.auditLog.findFirst({
      where: { organizationId, action: 'LOGIN' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, code: true, createdAt: true },
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      invited: invitedUsers,
      suspended: suspendedUsers,
    },
    roles: {
      total: totalRoles,
      system: systemRoles,
      custom: totalRoles - systemRoles,
    },
    activity: {
      last24h: recentActivity,
      lastSignInAt: lastSignIn?.createdAt.toISOString() ?? null,
    },
    organization: organization
      ? {
          name: organization.name,
          code: organization.code,
          createdAt: organization.createdAt.toISOString(),
        }
      : null,
  };
};
