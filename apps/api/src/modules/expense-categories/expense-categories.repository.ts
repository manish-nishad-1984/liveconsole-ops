import type { Prisma } from '@prisma/client';

import { resolveOrderBy, resolvePagination } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { and, equals, searchAcross } from '../../lib/query.js';
import { CATEGORY_SORT_FIELDS, type CategoryListQueryInput } from './expense-categories.schema.js';

export const categorySelect = {
  id: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} satisfies Prisma.ExpenseCategorySelect;

export type CategoryRecord = Prisma.ExpenseCategoryGetPayload<{
  select: typeof categorySelect;
}>;

export const listCategories = async (organizationId: string, query: CategoryListQueryInput) => {
  const where = and(
    { organizationId, deletedAt: null },
    searchAcross(query.search, ['name', 'description']),
    equals('isActive', query.isActive),
  ) as Prisma.ExpenseCategoryWhereInput;

  const { skip, take, page, pageSize } = resolvePagination(query);
  const orderBy = resolveOrderBy(query.sortBy, query.sortDir, CATEGORY_SORT_FIELDS, {
    field: 'sortOrder',
    dir: 'asc',
  }) as Prisma.ExpenseCategoryOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.expenseCategory.findMany({
      where,
      select: categorySelect,
      orderBy: [orderBy, { name: 'asc' }],
      skip,
      take,
    }),
    prisma.expenseCategory.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

export const findCategoryById = (organizationId: string, id: string) =>
  prisma.expenseCategory.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: categorySelect,
  });

export const findCategoryByName = (organizationId: string, name: string) =>
  prisma.expenseCategory.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      name: { equals: name, mode: 'insensitive' },
    },
    select: { id: true },
  });

export const createCategory = (data: Prisma.ExpenseCategoryUncheckedCreateInput) =>
  prisma.expenseCategory.create({ data, select: categorySelect });

export const updateCategory = (id: string, data: Prisma.ExpenseCategoryUncheckedUpdateInput) =>
  prisma.expenseCategory.update({
    where: { id },
    data,
    select: categorySelect,
  });

export const listCategoryOptions = (organizationId: string) =>
  prisma.expenseCategory.findMany({
    where: { organizationId, deletedAt: null, isActive: true },
    select: { id: true, name: true, description: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
