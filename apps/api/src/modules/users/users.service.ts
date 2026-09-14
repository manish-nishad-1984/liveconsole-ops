import type { BranchRef, Paginated, SetUserPasswordResponse, UserDto } from '@liveconsole-ops/types';

import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { buildPaginationMeta } from '../../lib/pagination.js';
import { generateTemporaryPassword, hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { auditCreate, auditUpdate, requireOrg } from '../../lib/requestContext.js';
import { diffRecords, recordAudit } from '../../services/audit.service.js';
import * as repository from './users.repository.js';
import type { UserRecord } from './users.repository.js';
import type {
  CreateUserInput,
  SetPasswordInput,
  SetStatusInput,
  UpdateUserInput,
  UserListQueryInput,
} from './users.schema.js';

/**
 * User administration. The rules enforced here:
 *  • Email and employee code are unique, checked before the write so the caller
 *    gets a field-level error rather than a raw constraint violation.
 *  • Every user carries at least one role.
 *  • The last active super admin cannot be suspended, disabled or deleted.
 *  • Losing access takes effect *now*: suspending, disabling, deleting or having
 *    a password reset revokes live refresh tokens and bumps `tokenVersion`,
 *    rather than waiting for the access token to expire on its own.
 */

const toDto = (user: UserRecord): UserDto => ({
  id: user.id,
  employeeCode: user.employeeCode,
  fullName: user.fullName,
  email: user.email,
  phone: user.mobile,
  avatarUrl: user.avatarUrl,
  designation: user.designation,
  status: user.status,
  isSuperAdmin: user.isSuperAdmin,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  branchId: user.branchId,
  branchName: user.branch?.name ?? null,
  reportsToId: user.reportsToId,
  reportsTo: user.reportsTo
    ? {
        id: user.reportsTo.id,
        fullName: user.reportsTo.fullName,
        email: user.reportsTo.email,
        avatarUrl: user.reportsTo.avatarUrl,
      }
    : null,
  roles: user.roles.map(({ role }) => role),
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  createdById: user.createdById,
  updatedById: user.updatedById,
});

export const list = async (query: UserListQueryInput): Promise<Paginated<UserDto>> => {
  const organizationId = requireOrg();
  const { items, total, page, pageSize } = await repository.listUsers(organizationId, query);
  return { items: items.map(toDto), pagination: buildPaginationMeta(total, { page, pageSize }) };
};

export const getById = async (id: string): Promise<UserDto> => {
  const user = await repository.findUserById(requireOrg(), id);
  if (!user) throw new NotFoundError('User');
  return toDto(user);
};

const assertRolesExist = async (organizationId: string, roleIds: string[]): Promise<void> => {
  const found = await repository.countRolesByIds(organizationId, roleIds);
  if (found !== roleIds.length) {
    throw new BusinessRuleError('One or more selected roles no longer exist');
  }
};

export const create = async (
  input: CreateUserInput,
): Promise<UserDto & { temporaryPassword: string | null }> => {
  const organizationId = requireOrg();

  if (await repository.findUserByEmail(input.email)) {
    throw new ConflictError('A user with this email already exists');
  }
  if (
    input.employeeCode &&
    (await repository.findUserByEmployeeCode(organizationId, input.employeeCode))
  ) {
    throw new ConflictError('A user with this employee code already exists');
  }
  await assertRolesExist(organizationId, input.roleIds);

  // No password supplied means an invite: a random temporary one is set and the
  // user is forced to change it on first sign-in.
  const isInvite = !input.password;
  const plainPassword = input.password ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(plainPassword);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await repository.createUser(
      {
        organization: { connect: { id: organizationId } },
        fullName: input.fullName,
        email: input.email,
        mobile: input.phone || null,
        employeeCode: input.employeeCode ?? null,
        designation: input.designation ?? null,
        passwordHash,
        status: isInvite ? 'INVITED' : 'ACTIVE',
        mustChangePassword: isInvite,
        ...(input.branchId ? { branch: { connect: { id: input.branchId } } } : {}),
        ...(input.reportsToId ? { reportsTo: { connect: { id: input.reportsToId } } } : {}),
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
        ...auditCreate(),
      },
      tx,
    );

    await recordAudit({
      action: 'CREATE',
      entityType: 'User',
      entityId: createdUser.id,
      entityLabel: createdUser.email,
      changes: diffRecords(null, {
        fullName: createdUser.fullName,
        email: createdUser.email,
        status: createdUser.status,
        roles: createdUser.roles.map(({ role }) => role.slug),
      }),
      db: tx,
    });

    return createdUser;
  });

  // The generated password is returned exactly once, so the administrator can
  // read it out. It is never stored in plaintext and never returned again.
  return { ...toDto(user), temporaryPassword: isInvite ? plainPassword : null };
};

export const update = async (id: string, input: UpdateUserInput): Promise<UserDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findUserById(organizationId, id);
  if (!existing) throw new NotFoundError('User');

  if (input.email && input.email !== existing.email) {
    const clash = await repository.findUserByEmail(input.email);
    if (clash && clash.id !== id) throw new ConflictError('A user with this email already exists');
  }

  if (input.employeeCode && input.employeeCode !== existing.employeeCode) {
    const clash = await repository.findUserByEmployeeCode(organizationId, input.employeeCode);
    if (clash && clash.id !== id) {
      throw new ConflictError('A user with this employee code already exists');
    }
  }

  if (input.reportsToId === id) {
    throw new BusinessRuleError('A user cannot report to themselves');
  }

  if (input.roleIds) {
    if (input.roleIds.length === 0) throw new BusinessRuleError('Assign at least one role');
    await assertRolesExist(organizationId, input.roleIds);
  }

  const losesAccess =
    input.isActive === false || input.status === 'DISABLED' || input.status === 'SUSPENDED';

  if (losesAccess && existing.isSuperAdmin) {
    const remaining = await repository.countActiveSuperAdmins(organizationId, id);
    if (remaining === 0) {
      throw new BusinessRuleError('At least one active super administrator must remain');
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    if (input.roleIds) await repository.replaceUserRoles(id, input.roleIds, tx);

    const updated = await repository.updateUser(
      id,
      {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { mobile: input.phone || null } : {}),
        ...(input.employeeCode !== undefined ? { employeeCode: input.employeeCode } : {}),
        ...(input.designation !== undefined ? { designation: input.designation } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.branchId !== undefined
          ? input.branchId
            ? { branch: { connect: { id: input.branchId } } }
            : { branch: { disconnect: true } }
          : {}),
        ...(input.reportsToId !== undefined
          ? input.reportsToId
            ? { reportsTo: { connect: { id: input.reportsToId } } }
            : { reportsTo: { disconnect: true } }
          : {}),
        // Losing access must end live sessions, not wait for them to expire.
        ...(losesAccess ? { tokenVersion: { increment: 1 } } : {}),
        ...auditUpdate(),
      },
      tx,
    );

    if (losesAccess) await repository.revokeUserSessions(id, 'ACCESS_REVOKED', tx);

    await recordAudit({
      action: input.roleIds
        ? 'PERMISSION_CHANGE'
        : input.status || input.isActive !== undefined
          ? 'STATUS_CHANGE'
          : 'UPDATE',
      entityType: 'User',
      entityId: id,
      entityLabel: updated.email,
      changes: diffRecords(
        { ...existing, roles: existing.roles.map(({ role }) => role.slug) },
        { ...updated, roles: updated.roles.map(({ role }) => role.slug) },
      ),
      db: tx,
    });

    return updated;
  });

  return toDto(user);
};

/**
 * Status changes are their own action so they can be permissioned separately from
 * ordinary profile edits — the person who edits a phone number is not necessarily
 * the person who may cut somebody's access off.
 */
export const setStatus = async (id: string, input: SetStatusInput): Promise<UserDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findUserById(organizationId, id);
  if (!existing) throw new NotFoundError('User');

  const losesAccess = input.status === 'SUSPENDED' || input.status === 'DISABLED';

  if (losesAccess && existing.isSuperAdmin) {
    const remaining = await repository.countActiveSuperAdmins(organizationId, id);
    if (remaining === 0) {
      throw new BusinessRuleError('At least one active super administrator must remain');
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await repository.updateUser(
      id,
      {
        status: input.status,
        isActive: !losesAccess,
        ...(losesAccess ? { tokenVersion: { increment: 1 } } : {}),
        ...auditUpdate(),
      },
      tx,
    );

    if (losesAccess) await repository.revokeUserSessions(id, `STATUS_${input.status}`, tx);

    await recordAudit({
      action: 'STATUS_CHANGE',
      entityType: 'User',
      entityId: id,
      entityLabel: updated.email,
      changes: { status: { from: existing.status, to: updated.status } },
      db: tx,
    });

    return updated;
  });

  return toDto(user);
};

/** Administrative password reset — the user is signed out of every device. */
export const setPassword = async (
  id: string,
  input: SetPasswordInput,
): Promise<SetUserPasswordResponse> => {
  const organizationId = requireOrg();
  const existing = await repository.findUserById(organizationId, id);
  if (!existing) throw new NotFoundError('User');

  const generated = input.password ? null : generateTemporaryPassword();
  const passwordHash = await hashPassword(input.password ?? generated!);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: input.mustChangePassword,
        tokenVersion: { increment: 1 },
        ...auditUpdate(),
      },
    });
    await repository.revokeUserSessions(id, 'PASSWORD_RESET_BY_ADMIN', tx);
  });

  await recordAudit({
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: id,
    entityLabel: existing.email,
  });

  // Shown once in the confirmation dialog and then gone.
  return { temporaryPassword: generated };
};

/** Soft delete. Audit rows point at this account and must stay readable. */
export const remove = async (id: string): Promise<UserDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findUserById(organizationId, id);
  if (!existing) throw new NotFoundError('User');

  if (existing.isSuperAdmin) {
    const remaining = await repository.countActiveSuperAdmins(organizationId, id);
    if (remaining === 0) {
      throw new BusinessRuleError('At least one active super administrator must remain');
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    const deleted = await repository.softDeleteUser(id, tx);
    await repository.revokeUserSessions(id, 'ACCOUNT_DELETED', tx);
    return deleted;
  });

  await recordAudit({
    action: 'DELETE',
    entityType: 'User',
    entityId: id,
    entityLabel: user.email,
    changes: { isActive: { from: true, to: false } },
  });

  return toDto(user);
};

export const listAssignable = (search?: string) =>
  repository.listAssignableUsers(requireOrg(), search);

export const listBranches = async (): Promise<BranchRef[]> =>
  repository.listBranches(requireOrg());

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * CSV rather than a spreadsheet library: a boilerplate should not ship a
 * dependency for a feature the project may never use, and every tool opens CSV.
 */
export const exportToCsv = async (query: UserListQueryInput): Promise<string> => {
  const users = await repository.listAllUsers(requireOrg(), query);

  await recordAudit({ action: 'EXPORT', entityType: 'User', entityLabel: `${users.length} rows` });

  const header = [
    'Employee Code',
    'Full Name',
    'Email',
    'Mobile',
    'Designation',
    'Branch',
    'Roles',
    'Reports To',
    'Status',
    'Active',
    'Last Login',
    'Created On',
  ];

  const rows = users.map((user) =>
    [
      user.employeeCode,
      user.fullName,
      user.email,
      user.mobile,
      user.designation,
      user.branch?.name ?? null,
      user.roles.map(({ role }) => role.name).join(', '),
      user.reportsTo?.fullName ?? null,
      user.status,
      user.isActive ? 'Yes' : 'No',
      user.lastLoginAt?.toISOString() ?? null,
      user.createdAt.toISOString(),
    ].map(csvCell),
  );

  return [header.map(csvCell).join(','), ...rows.map((row) => row.join(','))].join('\n');
};
