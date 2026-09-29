import type {
  ExpenseCategoryDto,
  ExpenseCategoryRequest,
  OptionDto,
  OrgSettingsDto,
  OrgSettingsRequest,
} from '@liveconsole-ops/types';

import { api, type QueryParams } from '@/lib/api-client';

export const expenseCategoriesService = {
  list: (params: QueryParams) => api.list<ExpenseCategoryDto>('/expense-categories', params),
  options: () => api.get<OptionDto[]>('/expense-categories/options'),
  create: (payload: ExpenseCategoryRequest) =>
    api.post<ExpenseCategoryDto>('/expense-categories', payload),
  update: (id: string, payload: Partial<ExpenseCategoryRequest>) =>
    api.patch<ExpenseCategoryDto>(`/expense-categories/${id}`, payload),
  remove: (id: string) => api.delete<ExpenseCategoryDto>(`/expense-categories/${id}`),
};

export const settingsService = {
  get: () => api.get<OrgSettingsDto>('/settings'),
  update: (payload: OrgSettingsRequest) => api.patch<OrgSettingsDto>('/settings', payload),
};

export const employeesService = {
  options: () => api.get<OptionDto[]>('/users/options'),
};
