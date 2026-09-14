import type { Prisma } from '@prisma/client';

import { resolveOrderBy, resolvePagination } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { and, dateRange, equals, searchAcross } from '../../lib/query.js';
import { AUDIT_SORT_FIELDS, type AuditListQueryInput } from './audit.schema.js';

export const auditSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  entityLabel: true,
  oldValues: true,
  newValues: true,
  changedFields: true,
  actorId: true,
  actorEmail: true,
  ipAddress: true,
  userAgent: true,
  requestId: true,
  createdAt: true,
  actor: { select: { id: true, fullName: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditRecord = Prisma.AuditLogGetPayload<{ select: typeof auditSelect }>;

export const listAuditLogs = async (organizationId: string, query: AuditListQueryInput) => {
  const { skip, take, page, pageSize } = resolvePagination(query);

  const where = and(
    { organizationId },
    searchAcross(query.search, ['entityLabel', 'entityType', 'actorEmail']),
    equals('action', query.action),
    equals('entityType', query.entityType),
    equals('entityId', query.entityId),
    equals('actorId', query.actorId),
    dateRange('createdAt', query.from, query.to),
  ) as Prisma.AuditLogWhereInput;

  const orderBy = resolveOrderBy(query.sortBy, query.sortDir, AUDIT_SORT_FIELDS, {
    field: 'createdAt',
    dir: 'desc',
  }) as Prisma.AuditLogOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, select: auditSelect, orderBy, skip, take }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

/** The distinct entity types present, for the filter dropdown. */
export const listEntityTypes = async (organizationId: string): Promise<string[]> => {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId },
    select: { entityType: true },
    distinct: ['entityType'],
    orderBy: { entityType: 'asc' },
  });
  return rows.map((row) => row.entityType);
};
