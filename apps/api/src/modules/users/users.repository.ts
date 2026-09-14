import type { Prisma } from '@prisma/client';

import { resolveOrderBy, resolvePagination } from '../../lib/pagination.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { and, equals, searchAcross } from '../../lib/query.js';
import { USER_SORT_FIELDS, type UserListQueryInput } from './users.schema.js';

/**
 * Data access for users — the reference implementation for the repository layer.
 * It owns `select` shapes, `where` construction and sorting, and exposes nothing
 * Prisma-specific beyond its own return types.
 *
 * Every query takes `organizationId` as a parameter rather than reading it from
 * anywhere: the caller got it from `requireOrg()`, which got it from the
 * authenticated session, and nothing here can widen that.
 */

export const userListSelect = {
  id: true,
  organizationId: true,
  employeeCode: true,
  fullName: true,
  email: true,
  mobile: true,
  avatarUrl: true,
  designation: true,
  status: true,
  isSuperAdmin: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
  branchId: true,
  branch: { select: { id: true, name: true } },
  reportsToId: true,
  reportsTo: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
  roles: { select: { role: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.UserSelect;

export type UserRecord = Prisma.UserGetPayload<{ select: typeof userListSelect }>;

const buildWhere = (organizationId: string, query: UserListQueryInput): Prisma.UserWhereInput =>
  and(
    { organizationId, deletedAt: null },
    searchAcross(query.search, ['fullName', 'email', 'mobile', 'employeeCode', 'designation']),
    equals('status', query.status),
    equals('branchId', query.branchId),
    equals('isActive', query.isActive),
    query.roleId ? { roles: { some: { roleId: query.roleId } } } : undefined,
  ) as Prisma.UserWhereInput;

export const listUsers = async (organizationId: string, query: UserListQueryInput) => {
  const { skip, take, page, pageSize } = resolvePagination(query);
  const where = buildWhere(organizationId, query);

  const orderBy = resolveOrderBy(query.sortBy, query.sortDir, USER_SORT_FIELDS, {
    field: 'fullName',
    dir: 'asc',
  }) as Prisma.UserOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: userListSelect, orderBy, skip, take }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

/** Unpaginated variant for CSV export. */
export const listAllUsers = (organizationId: string, query: UserListQueryInput) =>
  prisma.user.findMany({
    where: buildWhere(organizationId, query),
    select: userListSelect,
    orderBy: { fullName: 'asc' },
  });

/** Tenant-scoped by design: an id from another tenant simply is not found. */
export const findUserById = (organizationId: string, id: string) =>
  prisma.user.findFirst({ where: { id, organizationId }, select: userListSelect });

/** Email is globally unique, so this lookup is deliberately not tenant-scoped. */
export const findUserByEmail = (emailAddress: string) =>
  prisma.user.findUnique({ where: { email: emailAddress }, select: { id: true, email: true } });

/** Employee codes are unique per organisation, not globally. */
export const findUserByEmployeeCode = (organizationId: string, employeeCode: string) =>
  prisma.user.findUnique({
    where: { organizationId_employeeCode: { organizationId, employeeCode } },
    select: { id: true },
  });

export const createUser = (data: Prisma.UserCreateInput, db: Db = prisma) =>
  db.user.create({ data, select: userListSelect });

export const updateUser = (id: string, data: Prisma.UserUpdateInput, db: Db = prisma) =>
  db.user.update({ where: { id }, data, select: userListSelect });

/**
 * Replace the user's role set. Deleting the removals and inserting the additions
 * keeps existing rows (and their `createdAt`) intact, which matters when auditing
 * who was granted what and when.
 */
export const replaceUserRoles = async (userId: string, roleIds: string[], db: Db = prisma) => {
  await db.userRole.deleteMany({ where: { userId, roleId: { notIn: roleIds } } });
  await db.userRole.createMany({
    data: roleIds.map((roleId) => ({ userId, roleId })),
    skipDuplicates: true,
  });
};

/** Roles must belong to the caller's tenant — never assign another org's role. */
export const countRolesByIds = (organizationId: string, roleIds: string[]) =>
  prisma.role.count({ where: { id: { in: roleIds }, organizationId, isActive: true } });

export const revokeUserSessions = (userId: string, reason: string, db: Db = prisma) =>
  db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

/**
 * Users are soft-deleted, never removed — audit rows and `createdById` columns
 * point at them and must stay readable.
 */
export const softDeleteUser = (id: string, db: Db = prisma) =>
  db.user.update({
    where: { id },
    data: {
      isActive: false,
      status: 'DISABLED',
      deletedAt: new Date(),
      tokenVersion: { increment: 1 },
    },
    select: userListSelect,
  });

/** Guards the "last super admin" rule. */
export const countActiveSuperAdmins = (organizationId: string, excludingId?: string) =>
  prisma.user.count({
    where: {
      organizationId,
      isSuperAdmin: true,
      isActive: true,
      deletedAt: null,
      ...(excludingId ? { id: { not: excludingId } } : {}),
    },
  });

/** Lightweight list for owner/assignee pickers. */
export const listAssignableUsers = (organizationId: string, search?: string) =>
  prisma.user.findMany({
    where: and(
      { organizationId, isActive: true, deletedAt: null, status: 'ACTIVE' },
      searchAcross(search, ['fullName', 'email']),
    ) as Prisma.UserWhereInput,
    select: { id: true, fullName: true, email: true, avatarUrl: true, designation: true },
    orderBy: { fullName: 'asc' },
    take: 50,
  });

export const listBranches = (organizationId: string) =>
  prisma.branch.findMany({
    where: { organizationId, isActive: true, deletedAt: null },
    select: { id: true, code: true, name: true, isHeadOffice: true },
    orderBy: [{ isHeadOffice: 'desc' }, { name: 'asc' }],
  });
