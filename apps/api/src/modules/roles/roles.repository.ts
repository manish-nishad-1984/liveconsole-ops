import type { Prisma } from '@prisma/client';

import { resolveOrderBy, resolvePagination } from '../../lib/pagination.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { and, searchAcross } from '../../lib/query.js';
import { ROLE_SORT_FIELDS, type RoleListQueryInput } from './roles.schema.js';

export const roleSelect = {
  id: true,
  organizationId: true,
  name: true,
  slug: true,
  description: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
  permissions: { select: { permission: { select: { key: true } } } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

export type RoleRecord = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

export const listRoles = async (organizationId: string, query: RoleListQueryInput) => {
  const { skip, take, page, pageSize } = resolvePagination(query);

  const where = and(
    { organizationId, deletedAt: null },
    searchAcross(query.search, ['name', 'slug', 'description']),
  ) as Prisma.RoleWhereInput;

  const orderBy = resolveOrderBy(query.sortBy, query.sortDir, ROLE_SORT_FIELDS, {
    field: 'name',
    dir: 'asc',
  }) as Prisma.RoleOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.role.findMany({ where, select: roleSelect, orderBy, skip, take }),
    prisma.role.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

/** Tenant-scoped: a role id from another organisation simply is not found. */
export const findRoleById = (organizationId: string, id: string) =>
  prisma.role.findFirst({ where: { id, organizationId }, select: roleSelect });

/** Role slugs are unique per organisation. */
export const findRoleBySlug = (organizationId: string, slug: string) =>
  prisma.role.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
    select: { id: true, name: true },
  });

export const findPermissionIdsByKeys = (keys: string[]) =>
  prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });

export const createRole = (
  data: Omit<Prisma.RoleCreateInput, 'permissions'>,
  permissionIds: string[],
  db: Db = prisma,
) =>
  db.role.create({
    data: {
      ...data,
      permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
    },
    select: roleSelect,
  });

export const updateRole = (id: string, data: Prisma.RoleUpdateInput, db: Db = prisma) =>
  db.role.update({ where: { id }, data, select: roleSelect });

/**
 * Replace the role's permission set — the same diff-and-write the seeder uses.
 * Deleting the removals and inserting the additions keeps existing rows (and
 * their `createdAt`) intact, which matters when auditing who granted what.
 */
export const replaceRolePermissions = async (
  roleId: string,
  permissionIds: string[],
  db: Db = prisma,
) => {
  await db.rolePermission.deleteMany({
    where: { roleId, permissionId: { notIn: permissionIds } },
  });
  await db.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    skipDuplicates: true,
  });
};

export const deleteRole = (id: string, db: Db = prisma) =>
  db.role.delete({ where: { id }, select: { id: true, name: true } });

export const countUsersWithRole = (roleId: string) => prisma.userRole.count({ where: { roleId } });

export const listAllPermissions = () =>
  prisma.permission.findMany({
    select: { id: true, key: true, module: true, action: true, description: true },
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });
