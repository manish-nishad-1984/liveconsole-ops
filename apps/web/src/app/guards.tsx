import type { ModuleKey, PermissionKey } from '@liveconsole-ops/types';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { usePermissions } from '@/hooks/use-permissions';
import { ROUTES } from '@/routes/paths';
import { useAuthStore } from '@/store/auth.store';

/**
 * Route guards.
 *
 * Three states have to be distinguished, and conflating any two of them produces a
 * visible bug: `initialising` (the refresh cookie has not been checked yet — render
 * nothing decisive), `unauthenticated` (redirect to sign in), and authenticated but
 * unauthorised (render 403, *not* a redirect, so the URL stays shareable and the
 * user can see what they were denied).
 */

/** Requires a session. Remembers the attempted URL so sign-in can return to it. */
export const AuthGuard = () => {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'initialising') {
    return <LoadingState variant="page" label="Restoring your session…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
};

/** For sign-in and password screens: an authenticated user is sent to the app. */
export const GuestGuard = () => {
  const status = useAuthStore((state) => state.status);

  if (status === 'initialising') {
    return <LoadingState variant="page" label="Loading…" />;
  }

  if (status === 'authenticated') {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <Outlet />;
};

/**
 * Holds an account with `mustChangePassword` on the change-password screen.
 *
 * The flag is set when an administrator issues a temporary password, so until it
 * is cleared the account is, in effect, sharing a credential with whoever set it.
 * Signing out is the only other route allowed — trapping someone in a screen with
 * no way out would be worse than the risk being managed.
 */
export const PasswordChangeGuard = () => {
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword ?? false);
  const { pathname } = useLocation();

  if (mustChangePassword && pathname !== ROUTES.changePassword) {
    return <Navigate to={ROUTES.changePassword} replace />;
  }

  return <Outlet />;
};

/**
 * Requires a specific permission for a route subtree, mirroring the
 * `requirePermission` guard on the matching API route.
 */
export const PermissionGuard = ({
  permission,
  children,
}: {
  permission: PermissionKey;
  children?: ReactNode;
}) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) return <Navigate to={ROUTES.forbidden} replace />;

  return <>{children ?? <Outlet />}</>;
};

/** Any permission on the module is enough — used for module landing routes. */
export const ModuleGuard = ({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
  children?: ReactNode;
}) => {
  const { canAccessModule } = usePermissions();

  if (!canAccessModule(moduleKey)) return <Navigate to={ROUTES.forbidden} replace />;

  return <>{children ?? <Outlet />}</>;
};
