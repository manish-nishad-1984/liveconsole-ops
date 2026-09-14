import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';

import { AuthGuard, GuestGuard, PasswordChangeGuard } from '@/app/guards';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { moduleRoutes } from '@/routes/module-routes';
import { ROUTES } from '@/routes/paths';

/**
 * The route table.
 *
 * Three layers, and the order matters: the guest branch (sign-in, password reset)
 * renders under `AuthLayout`, the authenticated branch under `AppLayout`, and the
 * module routes are generated rather than listed — see `module-routes.tsx`.
 *
 * Pages are code-split so the initial bundle carries the shell and the dashboard
 * only; the rest arrive when first opened.
 */

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

const ProfilePage = lazy(() => import('@/pages/account/ProfilePage'));
const ChangePasswordPage = lazy(() => import('@/pages/account/ChangePasswordPage'));

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'));

export const router = createBrowserRouter([
  {
    element: <GuestGuard />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.login, element: <LoginPage /> },
          { path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
          { path: ROUTES.resetPassword, element: <ResetPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <PasswordChangeGuard />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to={ROUTES.dashboard} replace /> },

              /**
               * Your own account, not an admin module. These carry no permission
               * because everyone has one — and they are listed before the
               * generated module routes so they cannot be swallowed by a
               * module's splat and start demanding an admin permission.
               */
              { path: ROUTES.profile, element: <ProfilePage /> },
              { path: ROUTES.changePassword, element: <ChangePasswordPage /> },

              ...moduleRoutes,

              { path: ROUTES.forbidden, element: <ForbiddenPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
