/**
 * The authorization surface, in one file.
 *
 * `MODULE_PERMISSIONS` is the source of truth for every permission string in the
 * system. `ModuleKey` and `PermissionKey` are *derived* from that object literal
 * rather than maintained alongside it, so a typo in a nav guard, a route guard or
 * the seed script is a compile error instead of a silent 403.
 *
 * The seed script reads `ALL_PERMISSIONS` and reconciles the `Permission` table
 * against it — adding a module here and re-seeding creates the rows; removing one
 * prunes them. Never hand-edit `Permission` rows.
 */

export const ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'export',
  'import',
  'approve',
  'assign',
  'manage',
] as const;

export type ActionKey = (typeof ACTIONS)[number];

const CRUD = ['view', 'create', 'update', 'delete'] as const;

export const MODULE_PERMISSIONS = {
  dashboard: ['view', 'export'],
  users: [...CRUD, 'export', 'manage'],
  roles: [...CRUD],
  audit_logs: ['view', 'export'],
  notifications: ['view', 'manage'],
  company_settings: ['view', 'update', 'manage'],
  // <-- your project adds its real modules here, one line each, as they are built.
} as const satisfies Record<string, readonly ActionKey[]>;

export type ModuleKey = keyof typeof MODULE_PERMISSIONS;

export type PermissionKey = {
  [M in ModuleKey]: `${M}:${(typeof MODULE_PERMISSIONS)[M][number]}`;
}[ModuleKey];

export const MODULE_KEYS = Object.keys(MODULE_PERMISSIONS) as ModuleKey[];

export const ALL_PERMISSIONS: PermissionKey[] = MODULE_KEYS.flatMap((moduleKey) =>
  MODULE_PERMISSIONS[moduleKey].map((action) => `${moduleKey}:${action}` as PermissionKey),
);

/** Type-safe permission constructor — `permissionKey('users', 'create')`. */
export const permissionKey = <M extends ModuleKey>(
  moduleKey: M,
  action: (typeof MODULE_PERMISSIONS)[M][number],
): PermissionKey => `${moduleKey}:${action}` as PermissionKey;

export const SYSTEM_ROLES = ['super_admin', 'admin', 'viewer'] as const;
export type SystemRoleSlug = (typeof SYSTEM_ROLES)[number];

/** One module's slice of the permission matrix, as the role editor renders it. */
export interface PermissionCatalogEntry {
  key: PermissionKey;
  action: string;
  label: string;
}

export interface PermissionCatalogGroup {
  module: string;
  label: string;
  /** Nav group the module belongs to, so the matrix reads like the sidebar. */
  group: string;
  permissions: PermissionCatalogEntry[];
}
