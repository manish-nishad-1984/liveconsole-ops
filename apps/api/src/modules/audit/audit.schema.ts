import { AuditAction } from '@prisma/client';
import { z } from 'zod';

import { listQuery, uuid } from '../../lib/validators.js';

export const auditListQuerySchema = listQuery.extend({
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: uuid.optional(),
  actorId: uuid.optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const AUDIT_SORT_FIELDS = ['createdAt', 'action', 'entityType'] as const;

export type AuditListQueryInput = z.infer<typeof auditListQuerySchema>;
