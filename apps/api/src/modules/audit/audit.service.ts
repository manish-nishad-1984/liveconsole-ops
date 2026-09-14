import type { AuditLogDto, Paginated } from '@liveconsole-ops/types';

import { buildPaginationMeta } from '../../lib/pagination.js';
import { requireOrg } from '../../lib/requestContext.js';
import * as repository from './audit.repository.js';
import type { AuditRecord } from './audit.repository.js';
import type { AuditListQueryInput } from './audit.schema.js';

/**
 * The audit log is read-only by construction: there is no create, update or
 * delete here, and nothing outside `services/audit.service.ts` writes to the
 * table. A trail somebody can edit is not a trail.
 */

const toDto = (entry: AuditRecord): AuditLogDto => ({
  id: entry.id,
  action: entry.action,
  entityType: entry.entityType,
  entityId: entry.entityId,
  entityLabel: entry.entityLabel,
  oldValues: (entry.oldValues as Record<string, unknown> | null) ?? null,
  newValues: (entry.newValues as Record<string, unknown> | null) ?? null,
  changedFields: entry.changedFields,
  actorId: entry.actorId,
  actorEmail: entry.actorEmail,
  actorName: entry.actor?.fullName ?? null,
  ipAddress: entry.ipAddress,
  userAgent: entry.userAgent,
  requestId: entry.requestId,
  createdAt: entry.createdAt.toISOString(),
});

export const list = async (query: AuditListQueryInput): Promise<Paginated<AuditLogDto>> => {
  const { items, total, page, pageSize } = await repository.listAuditLogs(requireOrg(), query);
  return { items: items.map(toDto), pagination: buildPaginationMeta(total, { page, pageSize }) };
};

export const listEntityTypes = (): Promise<string[]> => repository.listEntityTypes(requireOrg());
