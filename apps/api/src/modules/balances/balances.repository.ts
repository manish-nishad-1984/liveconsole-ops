import type { Prisma } from '@prisma/client';

import { parseDateOnly } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { searchAcross } from '../../lib/query.js';

export const employeeSelect = {
  id: true,
  fullName: true,
  mobile: true,
  designation: true,
} satisfies Prisma.UserSelect;

export type EmployeeRecord = Prisma.UserGetPayload<{
  select: typeof employeeSelect;
}>;

/**
 * The people a balance sheet lists: everyone holding the Employee role, plus
 * anyone else with cash or expense activity (an administrator who also spends,
 * or an employee who has since left — their balance still has to be settled).
 */
export const listBalanceEmployees = (
  organizationId: string,
  withActivity: string[],
  search?: string,
) =>
  prisma.user.findMany({
    where: {
      organizationId,
      AND: [
        {
          OR: [
            { id: { in: withActivity } },
            {
              deletedAt: null,
              isActive: true,
              roles: { some: { role: { slug: 'employee' } } },
            },
          ],
        },
        (searchAcross(search, ['fullName', 'mobile', 'employeeCode']) ??
          {}) as Prisma.UserWhereInput,
      ],
    },
    select: employeeSelect,
    orderBy: { fullName: 'asc' },
  });

export const findEmployee = (organizationId: string, id: string) =>
  prisma.user.findFirst({
    where: { id, organizationId },
    select: employeeSelect,
  });

const range = (from?: string, to?: string) =>
  from || to
    ? {
        ...(from ? { gte: parseDateOnly(from) } : {}),
        ...(to ? { lte: parseDateOnly(to) } : {}),
      }
    : undefined;

export const statementCashEntries = (
  organizationId: string,
  employeeId: string,
  from?: string,
  to?: string,
) =>
  prisma.cashEntry.findMany({
    where: {
      organizationId,
      employeeId,
      deletedAt: null,
      entryDate: range(from, to),
    },
    select: {
      id: true,
      entryNo: true,
      type: true,
      entryDate: true,
      amount: true,
      paymentMode: true,
      referenceNo: true,
      notes: true,
      createdAt: true,
      site: { select: { name: true } },
    },
  });

export const statementExpenses = (
  organizationId: string,
  employeeId: string,
  from?: string,
  to?: string,
) =>
  prisma.expense.findMany({
    where: {
      organizationId,
      employeeId,
      deletedAt: null,
      status: 'APPROVED',
      expenseDate: range(from, to),
    },
    select: {
      id: true,
      expenseNo: true,
      expenseDate: true,
      amount: true,
      description: true,
      createdAt: true,
      site: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

export const pendingInRange = (
  organizationId: string,
  employeeId: string,
  from?: string,
  to?: string,
) =>
  prisma.expense.aggregate({
    where: {
      organizationId,
      employeeId,
      deletedAt: null,
      status: 'PENDING',
      expenseDate: range(from, to),
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
