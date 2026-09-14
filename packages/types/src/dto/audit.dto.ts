import type { ISODateString, UUID } from '../common.js';
import type { AuditAction } from '../enums.js';

export interface AuditLogDto {
  id: UUID;
  action: AuditAction;
  entityType: string;
  entityId: UUID | null;
  entityLabel: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedFields: string[];
  actorId: UUID | null;
  actorEmail: string | null;
  actorName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: ISODateString;
}
