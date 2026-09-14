import { ALL_PERMISSIONS, MODULE_KEYS, MODULE_PERMISSIONS } from '@liveconsole-ops/types';
import type { ModuleKey, PermissionKey } from '@liveconsole-ops/types';
import type { PrismaClient } from '@prisma/client';

/**
 * The RBAC seeder — idempotent by construction.
 *
 * The TypeScript catalog in `packages/types/src/rbac.ts` is the source of truth.
 * This reconciles the database against it: new keys are inserted, keys that no
 * longer exist in code are deleted, and each seeded role's grants are diffed
 * rather than recreated. Running it twice changes nothing; running it after
 * adding a module wires that module up completely.
 */

export const seedPermissions = async (
  prisma: PrismaClient,
): Promise<Map<string, string>> => {
  const rows = ALL_PERMISSIONS.map((key) => {
    const [module, action] = key.split(':') as [string, string];
    return { key, module, action };
  });

  await prisma.permission.createMany({ data: rows, skipDuplicates: true });

  // Prune anything the catalog no longer declares. Cascades clean up the grants.
  await prisma.permission.deleteMany({ where: { key: { notIn: ALL_PERMISSIONS } } });

  const all = await prisma.permission.findMany({ select: { id: true, key: true } });
  return new Map(all.map((permission) => [permission.key, permission.id]));
};

/** Every action on a module. */
const all = (moduleKey: ModuleKey): PermissionKey[] =>
  MODULE_PERMISSIONS[moduleKey].map((action) => `${moduleKey}:${action}` as PermissionKey);

/** Only the named actions on a module. */
const only = (moduleKey: ModuleKey, ...actions: string[]): PermissionKey[] =>
  actions
    .filter((action) => (MODULE_PERMISSIONS[moduleKey] as readonly string[]).includes(action))
    .map((action) => `${moduleKey}:${action}` as PermissionKey);

interface RoleSeed {
  slug: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

/**
 * The three roles every deployment starts with.
 *
 * `super_admin` also carries `isSuperAdmin` on the *account*, which bypasses
 * permission checks entirely — the grants here are what keeps the role readable
 * in the UI rather than looking empty.
 *
 * Add your own roles below as the project grows, and re-run `db:seed`.
 */
const ROLE_SEEDS: RoleSeed[] = [
  {
    slug: 'super_admin',
    name: 'Super Administrator',
    description: 'Bypasses every permission check.',
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full access, without the bypass flag.',
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    description: 'Read-only everywhere.',
    permissions: MODULE_KEYS.flatMap((moduleKey) => only(moduleKey, 'view')),
  },
];

export const seedRoles = async (
  prisma: PrismaClient,
  organizationId: string,
  permissionIds: Map<string, string>,
): Promise<Map<string, string>> => {
  const roleIds = new Map<string, string>();

  for (const seed of ROLE_SEEDS) {
    const role = await prisma.role.upsert({
      where: { organizationId_slug: { organizationId, slug: seed.slug } },
      create: {
        organizationId,
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        isSystem: true,
      },
      update: { name: seed.name, description: seed.description, isSystem: true },
      select: { id: true },
    });

    roleIds.set(seed.slug, role.id);

    const desiredIds = seed.permissions
      .map((key) => permissionIds.get(key))
      .filter((id): id is string => Boolean(id));

    // Diff rather than recreate: existing grants keep their `createdAt`, so the
    // audit answer to "when was this granted" survives every re-seed.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: desiredIds } },
    });
    await prisma.rolePermission.createMany({
      data: desiredIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  return roleIds;
};

export { all, only, ROLE_SEEDS };
