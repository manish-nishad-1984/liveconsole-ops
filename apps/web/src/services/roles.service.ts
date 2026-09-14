import type {
  CreateRoleRequest,
  PermissionCatalogGroup,
  RoleDto,
  UpdateRoleRequest,
} from '@liveconsole-ops/types';

import { api, type QueryParams } from '@/lib/api-client';

export const rolesService = {
  list: (params: QueryParams) => api.list<RoleDto>('/roles', params),

  getById: (id: string) => api.get<RoleDto>(`/roles/${id}`),

  /**
   * The matrix the role editor renders. Served from the TypeScript catalog, not
   * the database, so it always matches the permissions the routes actually check.
   */
  permissionCatalog: () => api.get<PermissionCatalogGroup[]>('/roles/permission-catalog'),

  create: (payload: CreateRoleRequest) => api.post<RoleDto>('/roles', payload),

  update: (id: string, payload: UpdateRoleRequest) => api.patch<RoleDto>(`/roles/${id}`, payload),

  remove: (id: string) => api.delete(`/roles/${id}`),
};
