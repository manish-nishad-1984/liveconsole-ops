import type { AuditLogDto } from '@liveconsole-ops/types';

import { api, type QueryParams } from '@/lib/api-client';

export const auditService = {
  list: (params: QueryParams) => api.list<AuditLogDto>('/audit-logs', params),
  entityTypes: () => api.get<string[]>('/audit-logs/entity-types'),
};
