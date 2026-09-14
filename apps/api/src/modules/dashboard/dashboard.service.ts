import type { AmountByName, DashboardSummaryDto } from '@liveconsole-ops/types';
import type { Prisma } from '@prisma/client';

import { ZERO, money, monthStartInIndia, parseDateOnly, toDecimal } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { actorCan, requireOrg } from '../../lib/requestContext.js';
import { computeTotals, employeeScope } from '../../services/ledger.service.js';
import * as balancesService from '../balances/balances.service.js';
import { expenseSelect } from '../expenses/expenses.repository.js';
import { toDtos as expensesToDtos } from '../expenses/expenses.service.js';
import * as vehicleRentalsService from '../vehicle-rentals/vehicle-rentals.service.js';

/**
 * The petty cash dashboard. An administrator sees the company; an employee sees
 * the same screen about themselves. Every figure comes from the same ledger the
 * Balances screen uses, so the two can never disagree.
 */

const TOP = 6;
/** Bucket key for expenses booked without a site. */
const NO_SITE = 'none';

const topByAmount = (
  rows: { key: string | null; amount: Prisma.Decimal | null }[],
  names: Map<string, string>,
): AmountByName[] =>
  rows
    .filter((row): row is { key: string; amount: Prisma.Decimal } => Boolean(row.key))
    .map((row) => ({
      id: row.key,
      name: names.get(row.key) ?? '—',
      amount: money(row.amount),
    }))
    .sort((a, b) => toDecimal(b.amount).comparedTo(toDecimal(a.amount)))
    .slice(0, TOP);

export const getSummary = async (): Promise<DashboardSummaryDto> => {
  const organizationId = requireOrg();
  const ownOnly = employeeScope('balances:manage', 'expenses:manage', 'expenses:approve');
  const employeeFilter = ownOnly ? { employeeId: ownOnly } : {};
  const monthStart = parseDateOnly(monthStartInIndia());

  const monthSpend = {
    organizationId,
    deletedAt: null,
    ...employeeFilter,
    expenseDate: { gte: monthStart },
    status: { in: ['PENDING', 'APPROVED'] },
  } satisfies Prisma.ExpenseWhereInput;

  const [
    ledger,
    monthGiven,
    monthApproved,
    monthSubmitted,
    pending,
    bySite,
    byCategory,
    employees,
    transport,
  ] = await Promise.all([
    computeTotals(organizationId, ownOnly ? { employeeIds: [ownOnly] } : {}),
    prisma.cashEntry.aggregate({
      where: {
        organizationId,
        deletedAt: null,
        ...employeeFilter,
        type: 'GIVEN',
        entryDate: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { ...monthSpend, status: 'APPROVED' },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({ where: monthSpend, _sum: { amount: true } }),
    prisma.expense.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...employeeFilter,
        status: 'PENDING',
      },
      select: expenseSelect,
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    }),
    prisma.expense.groupBy({
      by: ['siteId'],
      where: monthSpend,
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['categoryId'],
      where: monthSpend,
      _sum: { amount: true },
    }),
    ownOnly ? Promise.resolve([]) : balancesService.list({}),
    actorCan('transport:view') ? vehicleRentalsService.dashboardSummary() : Promise.resolve(null),
  ]);

  const [siteNames, categoryNames] = await Promise.all([
    prisma.site.findMany({
      where: { id: { in: bySite.flatMap((row) => (row.siteId ? [row.siteId] : [])) } },
      select: { id: true, name: true },
    }),
    prisma.expenseCategory.findMany({
      where: { id: { in: byCategory.map((row) => row.categoryId) } },
      select: { id: true, name: true },
    }),
  ]);

  let cashGiven = ZERO;
  let cashReturned = ZERO;
  let approvedExpenses = ZERO;
  let pendingExpenses = ZERO;
  let pendingCount = 0;
  for (const row of ledger.values()) {
    cashGiven = cashGiven.plus(row.cashGiven);
    cashReturned = cashReturned.plus(row.cashReturned);
    approvedExpenses = approvedExpenses.plus(row.approvedExpenses);
    pendingExpenses = pendingExpenses.plus(row.pendingExpenses);
    pendingCount += row.pendingCount;
  }

  return {
    scope: ownOnly ? 'own' : 'all',
    totals: {
      cashGiven: money(cashGiven),
      cashReturned: money(cashReturned),
      approvedExpenses: money(approvedExpenses),
      pendingExpenses: money(pendingExpenses),
      pendingCount,
      balance: money(cashGiven.minus(cashReturned).minus(approvedExpenses)),
    },
    thisMonth: {
      cashGiven: money(monthGiven._sum.amount),
      approvedExpenses: money(monthApproved._sum.amount),
      submittedExpenses: money(monthSubmitted._sum.amount),
    },
    employees: employees.slice(0, 10),
    pendingExpenses: await expensesToDtos(organizationId, pending),
    bySite: topByAmount(
      // Expenses without a site still count, under their own bar.
      bySite.map((row) => ({ key: row.siteId ?? NO_SITE, amount: row._sum.amount })),
      new Map([[NO_SITE, 'No site'], ...siteNames.map((site) => [site.id, site.name] as const)]),
    ),
    byCategory: topByAmount(
      byCategory.map((row) => ({
        key: row.categoryId,
        amount: row._sum.amount,
      })),
      new Map(categoryNames.map((category) => [category.id, category.name])),
    ),
    transport,
  };
};
