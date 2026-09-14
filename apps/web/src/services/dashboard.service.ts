import type { DashboardSummaryDto } from '@liveconsole-ops/types';

import { api } from '@/lib/api-client';

export const dashboardService = {
  summary: () => api.get<DashboardSummaryDto>('/dashboard'),
};
