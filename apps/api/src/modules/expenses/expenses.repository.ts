import type { Prisma } from '@prisma/client';

import { parseDateOnly } from '../../lib/money.js';
import { resolveOrderBy, resolvePagination } from '../../lib/pagination.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { and, equals, searchAcross } from '../../lib/query.js';
import { EXPENSE_SORT_FIELDS, type ExpenseListQueryInput } from './expenses.schema.js';

export const ATTACHMENT_ENTITY = 'Expense';

export const expenseSelect = {
  id: true,
  expenseNo: true,
  employeeId: true,
  employee: { select: { id: true, fullName: true } },
  site: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  siteId: true,
  categoryId: true,
  expenseDate: true,
  amount: true,
  paymentMode: true,
  paidTo: true,
  description: true,
  status: true,
  reviewedBy: { select: { id: true, fullName: true } },
  reviewedAt: true,
  reviewNote: true,
  rentPayment: { select: { id: true, rentalId: true, rental: { select: { rentalNo: true } } } },
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} satisfies Prisma.ExpenseSelect;

export type ExpenseRecord = Prisma.ExpenseGetPayload<{
  select: typeof expenseSelect;
}>;

/**
 * `employeeScope` null = every employee's expenses. `ignoreStatus` builds the
 * where for the status tiles, which must show every status whatever is selected.
 */
const buildWhere = (
  organizationId: string,
  query: ExpenseListQueryInput,
  employeeScope: string | null,
  ignoreStatus = false,
): Prisma.ExpenseWhereInput =>
  and(
    { organizationId, deletedAt: null },
    employeeScope ? { employeeId: employeeScope } : equals('employeeId', query.employeeId),
    ignoreStatus ? undefined : equals('status', query.status),
    equals('siteId', query.siteId),
    equals('categoryId', query.categoryId),
    equals('paymentMode', query.paymentMode),
    query.from || query.to
      ? {
          expenseDate: {
            ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
            ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
          },
        }
      : undefined,
    searchAcross(query.search, [
      'expenseNo',
      'description',
      'paidTo',
      'employee.fullName',
      'site.name',
    ]),
  ) as Prisma.ExpenseWhereInput;

export const listExpenses = async (
  organizationId: string,
  query: ExpenseListQueryInput,
  employeeScope: string | null,
) => {
  const where = buildWhere(organizationId, query, employeeScope);
  const { skip, take, page, pageSize } = resolvePagination(query);
  const orderBy = resolveOrderBy(query.sortBy, query.sortDir, EXPENSE_SORT_FIELDS, {
    field: 'expenseDate',
    dir: 'desc',
  }) as Prisma.ExpenseOrderByWithRelationInput;

  const [items, total, byStatus] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: expenseSelect,
      orderBy: [orderBy, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({
      by: ['status'],
      where: buildWhere(organizationId, query, employeeScope, true),
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return { items, total, page, pageSize, byStatus };
};

export const listAllExpenses = (
  organizationId: string,
  query: ExpenseListQueryInput,
  employeeScope: string | null,
) =>
  prisma.expense.findMany({
    where: buildWhere(organizationId, query, employeeScope),
    select: expenseSelect,
    orderBy: [{ expenseDate: 'asc' }, { createdAt: 'asc' }],
  });

export const findExpenseById = (
  organizationId: string,
  id: string,
  employeeScope: string | null,
  db: Db = prisma,
) =>
  db.expense.findFirst({
    where: {
      id,
      organizationId,
      deletedAt: null,
      ...(employeeScope ? { employeeId: employeeScope } : {}),
    },
    select: expenseSelect,
  });

export const createExpense = (data: Prisma.ExpenseUncheckedCreateInput, db: Db) =>
  db.expense.create({ data, select: expenseSelect });

export const updateExpense = (
  id: string,
  data: Prisma.ExpenseUncheckedUpdateInput,
  db: Db = prisma,
) => db.expense.update({ where: { id }, data, select: expenseSelect });

export const findPendingByIds = (organizationId: string, ids: string[]) =>
  prisma.expense.findMany({
    where: {
      organizationId,
      id: { in: ids },
      deletedAt: null,
      status: 'PENDING',
    },
    select: { id: true, expenseNo: true, amount: true },
  });

export const approveMany = (
  ids: string[],
  data: {
    reviewedById: string;
    reviewedAt: Date;
    reviewNote: string | null;
    updatedById: string;
  },
) =>
  prisma.expense.updateMany({
    // Re-checked here: something approved or rejected since the read stays as it is.
    where: { id: { in: ids }, status: 'PENDING', deletedAt: null },
    data: { ...data, status: 'APPROVED' },
  });

export const findActiveSite = (organizationId: string, id: string) =>
  prisma.site.findFirst({
    where: { id, organizationId, deletedAt: null, isActive: true },
    select: { id: true },
  });

export const findActiveCategory = (organizationId: string, id: string) =>
  prisma.expenseCategory.findFirst({
    where: { id, organizationId, deletedAt: null, isActive: true },
    select: { id: true },
  });

/* ------------------------------------------------------------------ */
/* Attachments                                                         */
/* ------------------------------------------------------------------ */

export const attachmentSelect = {
  id: true,
  fileName: true,
  storedName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AttachmentSelect;

export type AttachmentRecord = Prisma.AttachmentGetPayload<{
  select: typeof attachmentSelect;
}>;

export const listAttachments = (organizationId: string, expenseId: string) =>
  prisma.attachment.findMany({
    where: {
      organizationId,
      entityType: ATTACHMENT_ENTITY,
      entityId: expenseId,
    },
    select: attachmentSelect,
    orderBy: { createdAt: 'asc' },
  });

export const countAttachmentsByExpense = async (
  organizationId: string,
  expenseIds: string[],
): Promise<Map<string, number>> => {
  if (expenseIds.length === 0) return new Map();
  const rows = await prisma.attachment.groupBy({
    by: ['entityId'],
    where: {
      organizationId,
      entityType: ATTACHMENT_ENTITY,
      entityId: { in: expenseIds },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.entityId, row._count._all]));
};

export const findAttachment = (organizationId: string, expenseId: string, attachmentId: string) =>
  prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      organizationId,
      entityType: ATTACHMENT_ENTITY,
      entityId: expenseId,
    },
    select: attachmentSelect,
  });

export const createAttachment = (data: Prisma.AttachmentUncheckedCreateInput) =>
  prisma.attachment.create({ data, select: attachmentSelect });

export const deleteAttachment = (id: string) => prisma.attachment.delete({ where: { id } });
