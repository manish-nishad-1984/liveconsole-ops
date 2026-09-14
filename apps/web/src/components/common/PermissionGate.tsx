import type { PermissionKey } from '@liveconsole-ops/types';
import type { ReactNode } from 'react';

import { usePermissions } from '@/hooks/use-permissions';

export interface PermissionGateProps {
  /** Any one of these grants access. */
  permission: PermissionKey | PermissionKey[];
  /** Require every listed permission instead of any. */
  requireAll?: boolean;
  /** Rendered when the check fails. Defaults to nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally render by permission.
 *
 * This is presentation only — the API enforces the same permission on the route.
 * Hiding a button the user cannot use is a UX courtesy; it is never the control
 * that keeps them out. Both layers are required.
 */
export const PermissionGate = ({
  permission,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) => {
  const { canAny, canAll } = usePermissions();
  const permissions = Array.isArray(permission) ? permission : [permission];

  const allowed = requireAll ? canAll(permissions) : canAny(permissions);
  return <>{allowed ? children : fallback}</>;
};
