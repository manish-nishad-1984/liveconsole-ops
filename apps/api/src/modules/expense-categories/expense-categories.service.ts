import type { ExpenseCategoryDto, OptionDto, Paginated } from '@liveconsole-ops/types';

import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { buildPaginationMeta } from '../../lib/pagination.js';
import { auditCreate, auditUpdate, requireOrg } from '../../lib/requestContext.js';
import { diffRecords, recordAudit } from '../../services/audit.service.js';
import * as repository from './expense-categories.repository.js';
import type { CategoryRecord } from './expense-categories.repository.js';
import type {
  CategoryInput,
  CategoryListQueryInput,
  UpdateCategoryInput,
} from './expense-categories.schema.js';

const toDto = (category: CategoryRecord): ExpenseCategoryDto => ({
  ...category,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
});

export const list = async (
  query: CategoryListQueryInput,
): Promise<Paginated<ExpenseCategoryDto>> => {
  const { items, total, page, pageSize } = await repository.listCategories(requireOrg(), query);
  return {
    items: items.map(toDto),
    pagination: buildPaginationMeta(total, { page, pageSize }),
  };
};

const assertNameFree = async (organizationId: string, name: string, exceptId?: string) => {
  const clash = await repository.findCategoryByName(organizationId, name);
  if (clash && clash.id !== exceptId) {
    throw new ConflictError('A category with this name already exists');
  }
};

export const create = async (input: CategoryInput): Promise<ExpenseCategoryDto> => {
  const organizationId = requireOrg();
  await assertNameFree(organizationId, input.name);

  const category = await repository.createCategory({
    organizationId,
    name: input.name,
    description: input.description ?? null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
    ...auditCreate(),
  });

  await recordAudit({
    action: 'CREATE',
    entityType: 'ExpenseCategory',
    entityId: category.id,
    entityLabel: category.name,
  });

  return toDto(category);
};

export const update = async (
  id: string,
  input: UpdateCategoryInput,
): Promise<ExpenseCategoryDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findCategoryById(organizationId, id);
  if (!existing) throw new NotFoundError('Category');

  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameFree(organizationId, input.name, id);
  }

  const category = await repository.updateCategory(id, {
    ...input,
    ...auditUpdate(),
  });

  await recordAudit({
    action: 'UPDATE',
    entityType: 'ExpenseCategory',
    entityId: id,
    entityLabel: category.name,
    changes: diffRecords(existing, category),
  });

  return toDto(category);
};

/** Soft delete — past expenses keep their category. */
export const remove = async (id: string): Promise<ExpenseCategoryDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findCategoryById(organizationId, id);
  if (!existing) throw new NotFoundError('Category');

  const category = await repository.updateCategory(id, {
    isActive: false,
    deletedAt: new Date(),
    ...auditUpdate(),
  });

  await recordAudit({
    action: 'DELETE',
    entityType: 'ExpenseCategory',
    entityId: id,
    entityLabel: category.name,
  });

  return toDto(category);
};

export const options = async (): Promise<OptionDto[]> => {
  const categories = await repository.listCategoryOptions(requireOrg());
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    hint: category.description,
  }));
};
