import type { AuditFields, UUID } from '../common.js';
import type { PermissionKey } from '../rbac.js';

export interface RoleDto extends AuditFields {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissionCount: number;
  permissions: PermissionKey[];
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  permissions: PermissionKey[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string | null;
  permissions?: PermissionKey[];
  isActive?: boolean;
}
