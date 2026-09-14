import { MODULE_PERMISSIONS } from '@liveconsole-ops/types';
import type { ModuleKey, PermissionKey } from '@liveconsole-ops/types';

/**
 * Permission evaluation, shared so the UI hides exactly what the API rejects.
 *
 * Super admins short-circuit every *permission* check — that is the only implicit
 * grant in the system. Everything else is an explicit `<module>:<action>` string.
 */

export interface PermissionSubject {
  isSuperAdmin: boolean;
  permissions: readonly PermissionKey[];
  /** Role slugs held by the subject, e.g. `['admin']`. */
  roles?: readonly string[];
}

export interface PermissionChecker {
  hasPermission: (permission: PermissionKey) => boolean;
  hasAnyPermission: (permissions: readonly PermissionKey[]) => boolean;
  hasAllPermissions: (permissions: readonly PermissionKey[]) => boolean;
  hasRole: (role: string | readonly string[]) => boolean;
  /** True if the subject holds any permission at all on a module. */
  canAccessModule: (moduleKey: ModuleKey) => boolean;
  roles: readonly string[];

  /* Short aliases, used inline where the longer name reads as noise. */
  can: (permission: PermissionKey) => boolean;
  canAny: (permissions: readonly PermissionKey[]) => boolean;
  canAll: (permissions: readonly PermissionKey[]) => boolean;
}

export const createPermissionChecker = (
  subject: PermissionSubject | null | undefined,
): PermissionChecker => {
  const isSuperAdmin = subject?.isSuperAdmin === true;
  const granted = new Set<string>(subject?.permissions ?? []);
  const roles = subject?.roles ?? [];
  const roleSet = new Set<string>(roles);

  const hasPermission = (permission: PermissionKey) => isSuperAdmin || granted.has(permission);
  const hasAnyPermission = (permissions: readonly PermissionKey[]) =>
    isSuperAdmin || permissions.some((permission) => granted.has(permission));
  const hasAllPermissions = (permissions: readonly PermissionKey[]) =>
    isSuperAdmin || permissions.every((permission) => granted.has(permission));

  /**
   * Answers "is this person an administrator", not "may they do this" — so a
   * super admin who has not been given the role gets `false`. Gate features on
   * permissions; use roles for presentation only.
   */
  const hasRole = (role: string | readonly string[]) =>
    typeof role === 'string' ? roleSet.has(role) : role.some((slug) => roleSet.has(slug));

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccessModule: (moduleKey) =>
      isSuperAdmin ||
      MODULE_PERMISSIONS[moduleKey].some((action) => granted.has(`${moduleKey}:${action}`)),
    roles,

    can: hasPermission,
    canAny: hasAnyPermission,
    canAll: hasAllPermissions,
  };
};

/** Split `'users:create'` into its parts. */
export const parsePermission = (
  permission: PermissionKey,
): { module: ModuleKey; action: string } => {
  const [moduleKey, action] = permission.split(':') as [ModuleKey, string];
  return { module: moduleKey, action };
};

/** Group a flat permission list by module — the shape the role matrix renders. */
export const groupPermissionsByModule = (
  permissions: readonly PermissionKey[],
): Record<string, string[]> => {
  const grouped: Record<string, string[]> = {};
  for (const permission of permissions) {
    const { module: moduleKey, action } = parsePermission(permission);
    (grouped[moduleKey] ??= []).push(action);
  }
  return grouped;
};
