import type {
  BranchRef,
  CreateUserRequest,
  Paginated,
  SetUserPasswordRequest,
  SetUserPasswordResponse,
  UpdateUserRequest,
  UserDto,
  UserStatus,
} from '@liveconsole-ops/types';

import { api, type QueryParams } from '@/lib/api-client';

export const usersService = {
  list: (params: QueryParams) => api.list<UserDto>('/users', params),

  getById: (id: string) => api.get<UserDto>(`/users/${id}`),

  /** The response carries `temporaryPassword` exactly once, when one was generated. */
  create: (payload: CreateUserRequest) =>
    api.post<UserDto & { temporaryPassword: string | null }>('/users', payload),

  update: (id: string, payload: UpdateUserRequest) => api.patch<UserDto>(`/users/${id}`, payload),

  setStatus: (id: string, status: UserStatus) =>
    api.post<UserDto>(`/users/${id}/status`, { status }),

  setPassword: (id: string, payload: SetUserPasswordRequest) =>
    api.post<SetUserPasswordResponse>(`/users/${id}/password`, payload),

  remove: (id: string) => api.delete<UserDto>(`/users/${id}`),

  branches: () => api.get<BranchRef[]>('/users/branches'),

  assignable: (search?: string) =>
    api.get<{ id: string; fullName: string; email: string }[]>('/users/assignable', { search }),

  exportCsv: (params: QueryParams) => api.download('/users/export', params),
};

export type { Paginated };
