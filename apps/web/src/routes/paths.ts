import { getModule } from '@liveconsole-ops/shared';
import type { ModuleKey } from '@liveconsole-ops/types';

/**
 * Route paths.
 *
 * Module base paths are not repeated here — they live in the shared registry and
 * are read through `modulePath`. What this file owns is the paths that have no
 * module: authentication, the account screens, and error pages.
 */

export const ROUTES = {
  root: '/',
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  dashboard: '/dashboard',
  profile: '/settings/profile',
  changePassword: '/settings/password',
  forbidden: '/403',
} as const;

/** The base path of a module, e.g. `modulePath('users')` → `/users`. */
export const modulePath = (key: ModuleKey): string => getModule(key)?.path ?? '/';

/** Record routes, so a link to a detail screen is never hand-assembled. */
export const recordPath = {
  list: (key: ModuleKey): string => modulePath(key),
  new: (key: ModuleKey): string => `${modulePath(key)}/new`,
  detail: (key: ModuleKey, id: string): string => `${modulePath(key)}/${id}`,
  edit: (key: ModuleKey, id: string): string => `${modulePath(key)}/${id}/edit`,
};

/** The nested patterns a module's own route file registers under its base path. */
export const MODULE_CHILD_PATHS = {
  list: '',
  new: 'new',
  detail: ':id',
  edit: ':id/edit',
} as const;
