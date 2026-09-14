import { createPermissionChecker, type PermissionChecker } from '@liveconsole-ops/shared';
import type { ModuleKey, PermissionKey } from '@liveconsole-ops/types';
import { useMemo } from 'react';

import { useAuthStore } from '@/store/auth.store';

/**
 * Permission checks for the UI, backed by the same evaluator the API uses so the
 * two can never disagree about what a role allows.
 *
 * Hiding a control here is a courtesy, not a security boundary — the API enforces
 * the same permission on the route. Both layers are required.
 */
export const usePermissions = (): PermissionChecker => {
  const user = useAuthStore((state) => state.user);

  return useMemo(
    () =>
      createPermissionChecker(
        user
          ? {
              isSuperAdmin: user.isSuperAdmin,
              permissions: user.permissions,
              roles: user.roles.map((role) => role.slug),
            }
          : null,
      ),
    [user],
  );
};

/** Single-permission shorthand for inline `disabled`/render guards. */
export const useCan = (permission: PermissionKey): boolean =>
  usePermissions().hasPermission(permission);

export const useCanAccessModule = (moduleKey: ModuleKey): boolean =>
  usePermissions().canAccessModule(moduleKey);
