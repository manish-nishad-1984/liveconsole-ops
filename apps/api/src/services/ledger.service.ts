import type { PermissionKey } from '@liveconsole-ops/types';
import { Prisma } from '@prisma/client';

import { UnauthenticatedError } from '../lib/errors.js';
import { ZERO, parseDateOnly, toDecimal } from '../lib/money.js';
import { prisma, type Db } from '../lib/prisma.js';
import { actorCan, getActorId } from '../lib/requestContext.js';

/**
 * The petty cash ledger, stated once.
 *
 *   balance = cash GIVEN − cash RETURNED − expenses
 *
 * Balances, the statement, the dashboard and the "cannot return more than they
 * hold" rule all read from here, so there is exactly one definition of what an
 * employee holds. There is no approval step: an expense counts from the moment
 * it is filed.
 */

/**
 * Whose records the caller may see. `null` means everyone's; otherwise the id of
 * the only employee they may see — their own.
 */
export const employeeScope = (...seeAll: PermissionKey[]): string | null => {
  if (seeAll.some((permission) => actorCan(permission))) return null;
  const actorId = getActorId();
  if (!actorId) throw new UnauthenticatedError();
  return actorId;
};

export interface EmployeeTotals {
  cashGiven: Prisma.Decimal;
  cashReturned: Prisma.Decimal;
  expenses: Prisma.Decimal;
  expenseCount: number;
  balance: Prisma.Decimal;
}

const emptyTotals = (): EmployeeTotals => ({
  cashGiven: ZERO,
  cashReturned: ZERO,
  expenses: ZERO,
  expenseCount: 0,
  balance: ZERO,
});

export interface LedgerFilter {
  employeeIds?: string[];
  /** Inclusive upper bound on the document date. */
  onOrBefore?: string;
  /** Exclusive upper bound — for opening balances. */
  before?: string;
  /** Leave one cash entry out, e.g. the one being edited. */
  excludeCashEntryId?: string;
}

const dateBound = (filter: LedgerFilter): Prisma.DateTimeFilter | undefined => {
  if (filter.before) return { lt: parseDateOnly(filter.before) };
  if (filter.onOrBefore) return { lte: parseDateOnly(filter.onOrBefore) };
  return undefined;
};

/** Totals per employee, for every employee with any cash or expense activity. */
export const computeTotals = async (
  organizationId: string,
  filter: LedgerFilter = {},
  db: Db = prisma,
): Promise<Map<string, EmployeeTotals>> => {
  const employeeFilter = filter.employeeIds ? { in: filter.employeeIds } : undefined;
  const dates = dateBound(filter);

  const [cash, expenses] = await Promise.all([
    db.cashEntry.groupBy({
      by: ['employeeId', 'type'],
      where: {
        organizationId,
        deletedAt: null,
        employeeId: employeeFilter,
        entryDate: dates,
        ...(filter.excludeCashEntryId ? { id: { not: filter.excludeCashEntryId } } : {}),
      },
      _sum: { amount: true },
    }),
    db.expense.groupBy({
      by: ['employeeId'],
      where: {
        organizationId,
        deletedAt: null,
        employeeId: employeeFilter,
        expenseDate: dates,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const totals = new Map<string, EmployeeTotals>();
  const entry = (employeeId: string) => {
    let current = totals.get(employeeId);
    if (!current) {
      current = emptyTotals();
      totals.set(employeeId, current);
    }
    return current;
  };

  for (const row of cash) {
    const target = entry(row.employeeId);
    if (row.type === 'GIVEN') target.cashGiven = toDecimal(row._sum.amount);
    else target.cashReturned = toDecimal(row._sum.amount);
  }

  for (const row of expenses) {
    const target = entry(row.employeeId);
    target.expenses = toDecimal(row._sum.amount);
    target.expenseCount = row._count._all;
  }

  for (const value of totals.values()) {
    value.balance = value.cashGiven.minus(value.cashReturned).minus(value.expenses);
  }

  return totals;
};

export const totalsFor = async (
  organizationId: string,
  employeeId: string,
  filter: Omit<LedgerFilter, 'employeeIds'> = {},
  db: Db = prisma,
): Promise<EmployeeTotals> => {
  const totals = await computeTotals(organizationId, { ...filter, employeeIds: [employeeId] }, db);
  return totals.get(employeeId) ?? emptyTotals();
};

/** Latest document date per employee, for "last activity" columns. */
export const lastActivityDates = async (
  organizationId: string,
  employeeIds?: string[],
): Promise<Map<string, Date>> => {
  const employeeFilter = employeeIds ? { in: employeeIds } : undefined;

  const [cash, expenses] = await Promise.all([
    prisma.cashEntry.groupBy({
      by: ['employeeId'],
      where: { organizationId, deletedAt: null, employeeId: employeeFilter },
      _max: { entryDate: true },
    }),
    prisma.expense.groupBy({
      by: ['employeeId'],
      where: { organizationId, deletedAt: null, employeeId: employeeFilter },
      _max: { expenseDate: true },
    }),
  ]);

  const latest = new Map<string, Date>();
  const consider = (employeeId: string, date: Date | null) => {
    if (!date) return;
    const current = latest.get(employeeId);
    if (!current || date > current) latest.set(employeeId, date);
  };

  for (const row of cash) consider(row.employeeId, row._max.entryDate);
  for (const row of expenses) consider(row.employeeId, row._max.expenseDate);

  return latest;
};

/** An active account in the caller's organisation — the only valid employee. */
export const findActiveEmployee = (organizationId: string, id: string, db: Db = prisma) =>
  db.user.findFirst({
    where: { id, organizationId, deletedAt: null, isActive: true },
    select: { id: true, fullName: true, mobile: true, designation: true },
  });
