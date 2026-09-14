import type {
  ExpenseCategoryDto,
  ExpenseCategoryRequest,
  OptionDto,
  SiteDto,
  SiteRequest,
} from '@liveconsole-ops/types';

import { api, type QueryParams } from '@/lib/api-client';

export const sitesService = {
  list: (params: QueryParams) => api.list<SiteDto>('/sites', params),
  options: () => api.get<OptionDto[]>('/sites/options'),
  create: (payload: SiteRequest) => api.post<SiteDto>('/sites', payload),
  update: (id: string, payload: Partial<SiteRequest>) =>
    api.patch<SiteDto>(`/sites/${id}`, payload),
  remove: (id: string) => api.delete<SiteDto>(`/sites/${id}`),
};

export const expenseCategoriesService = {
  list: (params: QueryParams) => api.list<ExpenseCategoryDto>('/expense-categories', params),
  options: () => api.get<OptionDto[]>('/expense-categories/options'),
  create: (payload: ExpenseCategoryRequest) =>
    api.post<ExpenseCategoryDto>('/expense-categories', payload),
  update: (id: string, payload: Partial<ExpenseCategoryRequest>) =>
    api.patch<ExpenseCategoryDto>(`/expense-categories/${id}`, payload),
  remove: (id: string) => api.delete<ExpenseCategoryDto>(`/expense-categories/${id}`),
};

export const employeesService = {
  options: () => api.get<OptionDto[]>('/users/options'),
};
