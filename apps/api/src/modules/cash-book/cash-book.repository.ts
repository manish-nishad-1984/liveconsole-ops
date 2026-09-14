import type { Prisma } from '@prisma/client';

import { parseDateOnly } from '../../lib/money.js';
import { resolveOrderBy, resolvePagination } from '../../lib/pagination.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { and, equals, searchAcross } from '../../lib/query.js';
import { CASH_ENTRY_SORT_FIELDS, type CashEntryListQueryInput } from './cash-book.schema.js';

export const cashEntrySelect = {
  id: true,
  entryNo: true,
  type: true,
  employeeId: true,
  employee: { select: { id: true, fullName: true } },
  siteId: true,
  site: { select: { id: true, name: true } },
  entryDate: true,
  amount: true,
  paymentMode: true,
  referenceNo: true,
  notes: true,
  handledBy: { select: { id: true, fullName: true } },
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} satisfies Prisma.CashEntrySelect;

export type CashEntryRecord = Prisma.CashEntryGetPayload<{
  select: typeof cashEntrySelect;
}>;

/** `employeeScope` null = every employee; otherwise only that employee's entries. */
const buildWhere = (
  organizationId: string,
  query: CashEntryListQueryInput,
  employeeScope: string | null,
): Prisma.CashEntryWhereInput =>
  and(
    { organizationId, deletedAt: null },
    employeeScope ? { employeeId: employeeScope } : equals('employeeId', query.employeeId),
    equals('type', query.type),
    equals('siteId', query.siteId),
    equals('paymentMode', query.paymentMode),
    query.from || query.to
      ? {
          entryDate: {
            ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
            ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
          },
        }
      : undefined,
    searchAcross(query.search, ['entryNo', 'referenceNo', 'notes', 'employee.fullName']),
  ) as Prisma.CashEntryWhereInput;

export const listCashEntries = async (
  organizationId: string,
  query: CashEntryListQueryInput,
  employeeScope: string | null,
) => {
  const where = buildWhere(organizationId, query, employeeScope);
  const { skip, take, page, pageSize } = resolvePagination(query);
  const orderBy = resolveOrderBy(query.sortBy, query.sortDir, CASH_ENTRY_SORT_FIELDS, {
    field: 'entryDate',
    dir: 'desc',
  }) as Prisma.CashEntryOrderByWithRelationInput;

  const [items, total, totals] = await Promise.all([
    prisma.cashEntry.findMany({
      where,
      select: cashEntrySelect,
      orderBy: [orderBy, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.cashEntry.count({ where }),
    prisma.cashEntry.groupBy({ by: ['type'], where, _sum: { amount: true } }),
  ]);

  return { items, total, page, pageSize, totals };
};

export const listAllCashEntries = (
  organizationId: string,
  query: CashEntryListQueryInput,
  employeeScope: string | null,
) =>
  prisma.cashEntry.findMany({
    where: buildWhere(organizationId, query, employeeScope),
    select: cashEntrySelect,
    orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
  });

export const findCashEntryById = (
  organizationId: string,
  id: string,
  employeeScope: string | null,
) =>
  prisma.cashEntry.findFirst({
    where: {
      id,
      organizationId,
      deletedAt: null,
      ...(employeeScope ? { employeeId: employeeScope } : {}),
    },
    select: cashEntrySelect,
  });

export const createCashEntry = (data: Prisma.CashEntryUncheckedCreateInput, db: Db) =>
  db.cashEntry.create({ data, select: cashEntrySelect });

export const updateCashEntry = (
  id: string,
  data: Prisma.CashEntryUncheckedUpdateInput,
  db: Db = prisma,
) => db.cashEntry.update({ where: { id }, data, select: cashEntrySelect });

export const findActiveSite = (organizationId: string, id: string) =>
  prisma.site.findFirst({
    where: { id, organizationId, deletedAt: null, isActive: true },
    select: { id: true },
  });
