import type {
  AttachmentDto,
  BalanceRowDto,
  CashBookListDto,
  CashEntryDto,
  CashEntryRequest,
  ExpenseDto,
  ExpenseListDto,
  ExpenseRequest,
  StatementDto,
} from '@liveconsole-ops/types';

import { api, type QueryParams } from '@/lib/api-client';

export const cashBookService = {
  list: (params: QueryParams) => api.get<CashBookListDto>('/cash-book', params),
  create: (payload: CashEntryRequest) => api.post<CashEntryDto>('/cash-book', payload),
  update: (id: string, payload: Partial<CashEntryRequest>) =>
    api.patch<CashEntryDto>(`/cash-book/${id}`, payload),
  remove: (id: string) => api.delete<CashEntryDto>(`/cash-book/${id}`),
  exportCsv: (params: QueryParams) => api.download('/cash-book/export', params),
};

export const expensesService = {
  list: (params: QueryParams) => api.get<ExpenseListDto>('/expenses', params),
  getById: (id: string) => api.get<ExpenseDto>(`/expenses/${id}`),
  create: (payload: ExpenseRequest) => api.post<ExpenseDto>('/expenses', payload),
  update: (id: string, payload: Partial<ExpenseRequest>) =>
    api.patch<ExpenseDto>(`/expenses/${id}`, payload),
  remove: (id: string) => api.delete<ExpenseDto>(`/expenses/${id}`),

  uploadReceipt: (id: string, file: Blob, fileName: string) =>
    api.upload<AttachmentDto>(`/expenses/${id}/attachments`, file, fileName),
  receiptBlob: (id: string, attachmentId: string) =>
    api.download(`/expenses/${id}/attachments/${attachmentId}`),
  removeReceipt: (id: string, attachmentId: string) =>
    api.delete(`/expenses/${id}/attachments/${attachmentId}`),

  exportCsv: (params: QueryParams) => api.download('/expenses/export', params),
};

export const balancesService = {
  list: (params: QueryParams) => api.get<BalanceRowDto[]>('/balances', params),
  statement: (userId: string, params: QueryParams) =>
    api.get<StatementDto>(`/balances/${userId}/statement`, params),
  exportCsv: (params: QueryParams) => api.download('/balances/export', params),
  exportStatementCsv: (userId: string, params: QueryParams) =>
    api.download(`/balances/${userId}/statement/export`, params),
};
