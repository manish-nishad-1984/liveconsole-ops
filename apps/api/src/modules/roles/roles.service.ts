import { getModule, humanizeEnum, slugify } from '@liveconsole-ops/shared';
import { MODULE_KEYS, MODULE_PERMISSIONS } from '@liveconsole-ops/types';
import type {
  Paginated,
  PermissionCatalogGroup,
  PermissionKey,
  RoleDto,
} from '@liveconsole-ops/types';

import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { buildPaginationMeta } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { auditCreate, auditUpdate, requireOrg } from '../../lib/requestContext.js';
import { diffRecords, recordAudit } from '../../services/audit.service.js';
import * as repository from './roles.repository.js';
import type { RoleRecord } from './roles.repository.js';
import type { CreateRoleInput, RoleListQueryInput, UpdateRoleInput } from './roles.schema.js';

/**
 * Role administration — the screen that makes the permission system usable.
 *
 * System roles are protected from rename and deletion but their permission sets
 * stay editable: that is the compromise between a predictable seeded hierarchy
 * and a business that genuinely needs to move one permission between two roles.
 * `super_admin` is the exception — it holds everything by definition, and editing
 * it would be a way to quietly lock everybody out.
 */

const toDto = (role: RoleRecord): RoleDto => {
  const permissions = role.permissions
    .map(({ permission }) => permission.key as PermissionKey)
    .sort();

  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    userCount: role._count.users,
    permissionCount: permissions.length,
    permissions,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
    createdById: role.createdById,
    updatedById: role.updatedById,
  };
};

export const list = async (query: RoleListQueryInput): Promise<Paginated<RoleDto>> => {
  const { items, total, page, pageSize } = await repository.listRoles(requireOrg(), query);
  return { items: items.map(toDto), pagination: buildPaginationMeta(total, { page, pageSize }) };
};

export const getById = async (id: string): Promise<RoleDto> => {
  const role = await repository.findRoleById(requireOrg(), id);
  if (!role) throw new NotFoundError('Role');
  return toDto(role);
};

/** Resolve permission keys to ids, rejecting any the database does not know. */
const resolvePermissionIds = async (keys: string[]): Promise<string[]> => {
  const found = await repository.findPermissionIdsByKeys(keys);
  if (found.length !== keys.length) {
    const missing = keys.filter((key) => !found.some((permission) => permission.key === key));
    throw new BusinessRuleError(
      `Unknown permission(s): ${missing.join(', ')}. Re-run the permission seed.`,
    );
  }
  return found.map((permission) => permission.id);
};

export const create = async (input: CreateRoleInput): Promise<RoleDto> => {
  const organizationId = requireOrg();

  const slug = slugify(input.name);
  if (await repository.findRoleBySlug(organizationId, slug)) {
    throw new ConflictError('A role with this name already exists');
  }

  const permissionIds = await resolvePermissionIds(input.permissions);

  const role = await prisma.$transaction(async (tx) => {
    const createdRole = await repository.createRole(
      {
        organization: { connect: { id: organizationId } },
        name: input.name,
        slug,
        description: input.description ?? null,
        isSystem: false,
        ...auditCreate(),
      },
      permissionIds,
      tx,
    );

    await recordAudit({
      action: 'CREATE',
      entityType: 'Role',
      entityId: createdRole.id,
      entityLabel: createdRole.name,
      changes: diffRecords(null, { name: createdRole.name, permissions: input.permissions }),
      db: tx,
    });

    return createdRole;
  });

  return toDto(role);
};

export const update = async (id: string, input: UpdateRoleInput): Promise<RoleDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findRoleById(organizationId, id);
  if (!existing) throw new NotFoundError('Role');

  if (existing.isSystem && input.name && input.name !== existing.name) {
    throw new BusinessRuleError('System roles cannot be renamed');
  }
  if (existing.isSystem && input.isActive === false) {
    throw new BusinessRuleError('System roles cannot be deactivated');
  }
  if (existing.slug === 'super_admin' && input.permissions) {
    throw new BusinessRuleError(
      'The super administrator role always holds every permission and cannot be edited',
    );
  }

  if (input.name && input.name !== existing.name) {
    const clash = await repository.findRoleBySlug(organizationId, slugify(input.name));
    if (clash && clash.id !== id) throw new ConflictError('A role with this name already exists');
  }

  const permissionIds = input.permissions
    ? await resolvePermissionIds(input.permissions)
    : undefined;

  const role = await prisma.$transaction(async (tx) => {
    if (permissionIds) await repository.replaceRolePermissions(id, permissionIds, tx);

    const updated = await repository.updateRole(
      id,
      {
        ...(input.name !== undefined && !existing.isSystem
          ? { name: input.name, slug: slugify(input.name) }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...auditUpdate(),
      },
      tx,
    );

    await recordAudit({
      action: input.permissions ? 'PERMISSION_CHANGE' : 'UPDATE',
      entityType: 'Role',
      entityId: id,
      entityLabel: updated.name,
      changes: diffRecords(
        {
          name: existing.name,
          description: existing.description,
          isActive: existing.isActive,
          permissions: existing.permissions.map(({ permission }) => permission.key).sort(),
        },
        {
          name: updated.name,
          description: updated.description,
          isActive: updated.isActive,
          permissions: updated.permissions.map(({ permission }) => permission.key).sort(),
        },
      ),
      db: tx,
    });

    return updated;
  });

  return toDto(role);
};

export const remove = async (id: string): Promise<void> => {
  const existing = await repository.findRoleById(requireOrg(), id);
  if (!existing) throw new NotFoundError('Role');
  if (existing.isSystem) throw new BusinessRuleError('System roles cannot be deleted');

  const assigned = await repository.countUsersWithRole(id);
  if (assigned > 0) {
    throw new BusinessRuleError(
      `This role is assigned to ${assigned} user${assigned === 1 ? '' : 's'}. Reassign them first.`,
    );
  }

  await repository.deleteRole(id);

  await recordAudit({
    action: 'DELETE',
    entityType: 'Role',
    entityId: id,
    entityLabel: existing.name,
  });
};

/**
 * The permission matrix the role editor renders.
 *
 * Deliberately *not* a database query: it reads `MODULE_PERMISSIONS` straight out
 * of the TypeScript catalog, so the editor always offers exactly the permissions
 * that exist in code. A permission row that had drifted out of the catalog would
 * otherwise be offered here and then never checked by any route.
 *
 * Ordering and grouping come from the module registry, so the matrix reads in the
 * same order as the sidebar.
 */
export const getPermissionCatalog = (): PermissionCatalogGroup[] =>
  MODULE_KEYS.map((moduleKey) => {
    const definition = getModule(moduleKey);

    return {
      module: moduleKey,
      label: definition?.label ?? humanizeEnum(moduleKey.toUpperCase()),
      // Modules with no nav entry still need somewhere to sit in the matrix.
      group: definition?.group ?? 'admin',
      permissions: MODULE_PERMISSIONS[moduleKey].map((action) => ({
        key: `${moduleKey}:${action}` as PermissionKey,
        action,
        label: humanizeEnum(action.toUpperCase()),
      })),
    };
  });
