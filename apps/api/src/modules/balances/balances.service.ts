import type { BalanceRowDto, StatementDto, StatementLineDto } from '@liveconsole-ops/types';

import { toCsv } from '../../lib/csv.js';
import { NotFoundError } from '../../lib/errors.js';
import { ZERO, formatDateOnly, money, toDecimal } from '../../lib/money.js';
import { requireOrg } from '../../lib/requestContext.js';
import { recordAudit } from '../../services/audit.service.js';
import {
  computeTotals,
  employeeScope,
  lastActivityDates,
  totalsFor,
} from '../../services/ledger.service.js';
import * as repository from './balances.repository.js';
import type { EmployeeRecord } from './balances.repository.js';
import type { BalanceListQueryInput, StatementQueryInput } from './balances.schema.js';

/**
 * Balances and statements — read-only views over the ledger. An employee sees
 * only their own; `balances:manage` sees everyone.
 */

const scope = () => employeeScope('balances:manage');

const employeeRef = (employee: EmployeeRecord): BalanceRowDto['employee'] => ({
  id: employee.id,
  fullName: employee.fullName,
  mobile: employee.mobile,
  designation: employee.designation,
});

/** Largest balance first: whoever is holding the most company cash leads. */
export const list = async (query: BalanceListQueryInput): Promise<BalanceRowDto[]> => {
  const organizationId = requireOrg();
  const ownOnly = scope();

  const totals = await computeTotals(organizationId, ownOnly ? { employeeIds: [ownOnly] } : {});

  const employees = ownOnly
    ? [await repository.findEmployee(organizationId, ownOnly)].filter(
        (employee): employee is EmployeeRecord => Boolean(employee),
      )
    : await repository.listBalanceEmployees(organizationId, [...totals.keys()], query.search);

  const lastActivity = await lastActivityDates(
    organizationId,
    employees.map((employee) => employee.id),
  );

  return employees
    .map((employee) => {
      const row = totals.get(employee.id);
      const lastDate = lastActivity.get(employee.id);
      return {
        employee: employeeRef(employee),
        cashGiven: money(row?.cashGiven),
        cashReturned: money(row?.cashReturned),
        approvedExpenses: money(row?.approvedExpenses),
        pendingExpenses: money(row?.pendingExpenses),
        pendingCount: row?.pendingCount ?? 0,
        balance: money(row?.balance),
        lastActivityOn: lastDate ? formatDateOnly(lastDate) : null,
      };
    })
    .sort((a, b) => toDecimal(b.balance).comparedTo(toDecimal(a.balance)));
};

export const statement = async (
  userId: string,
  query: StatementQueryInput,
): Promise<StatementDto> => {
  const organizationId = requireOrg();
  const ownOnly = scope();
  // Someone else's statement is "not found", not "forbidden" — it does not exist
  // as far as this caller is concerned.
  if (ownOnly && ownOnly !== userId) throw new NotFoundError('Employee');

  const employee = await repository.findEmployee(organizationId, userId);
  if (!employee) throw new NotFoundError('Employee');

  const [opening, cashEntries, expenses, pending] = await Promise.all([
    query.from ? totalsFor(organizationId, userId, { before: query.from }) : null,
    repository.statementCashEntries(organizationId, userId, query.from, query.to),
    repository.statementExpenses(organizationId, userId, query.from, query.to),
    repository.pendingInRange(organizationId, userId, query.from, query.to),
  ]);

  type Unsorted = Omit<StatementLineDto, 'runningBalance'> & {
    sortAt: number;
    signed: ReturnType<typeof toDecimal>;
  };

  const unsorted: Unsorted[] = [
    ...cashEntries.map((entry) => {
      const given = entry.type === 'GIVEN';
      const detail = [entry.paymentMode, entry.referenceNo, entry.notes]
        .filter(Boolean)
        .join(' · ');
      return {
        id: entry.id,
        kind: given ? ('CASH_GIVEN' as const) : ('CASH_RETURNED' as const),
        date: formatDateOnly(entry.entryDate),
        documentNo: entry.entryNo,
        particulars: `${given ? 'Cash received' : 'Cash returned'}${detail ? ` — ${detail}` : ''}`,
        site: entry.site?.name ?? null,
        credit: given ? money(entry.amount) : null,
        debit: given ? null : money(entry.amount),
        sortAt: entry.createdAt.getTime(),
        signed: given ? toDecimal(entry.amount) : toDecimal(entry.amount).negated(),
      };
    }),
    ...expenses.map((expense) => ({
      id: expense.id,
      kind: 'EXPENSE' as const,
      date: formatDateOnly(expense.expenseDate),
      documentNo: expense.expenseNo,
      particulars: `${expense.category.name} — ${expense.description}`,
      site: expense.site.name,
      credit: null,
      debit: money(expense.amount),
      sortAt: expense.createdAt.getTime(),
      signed: toDecimal(expense.amount).negated(),
    })),
  ].sort((a, b) => (a.date === b.date ? a.sortAt - b.sortAt : a.date < b.date ? -1 : 1));

  const openingBalance = opening?.balance ?? ZERO;
  let running = openingBalance;
  let totalCredit = ZERO;
  let totalDebit = ZERO;

  const lines: StatementLineDto[] = unsorted.map(({ sortAt: _sortAt, signed, ...line }) => {
    running = running.plus(signed);
    if (line.credit) totalCredit = totalCredit.plus(toDecimal(line.credit));
    if (line.debit) totalDebit = totalDebit.plus(toDecimal(line.debit));
    return { ...line, runningBalance: money(running) };
  });

  return {
    employee: employeeRef(employee),
    from: query.from ?? null,
    to: query.to ?? null,
    openingBalance: money(openingBalance),
    totalCredit: money(totalCredit),
    totalDebit: money(totalDebit),
    closingBalance: money(running),
    lines,
    pending: { count: pending._count._all, amount: money(pending._sum.amount) },
  };
};

export const exportBalancesCsv = async (query: BalanceListQueryInput): Promise<string> => {
  const rows = await list(query);
  await recordAudit({
    action: 'EXPORT',
    entityType: 'Balance',
    entityLabel: `${rows.length} rows`,
  });

  return toCsv(
    [
      'Employee',
      'Mobile',
      'Cash Given',
      'Cash Returned',
      'Approved Expenses',
      'Pending Expenses',
      'Pending Count',
      'Balance',
      'Last Activity',
    ],
    rows.map((row) => [
      row.employee.fullName,
      row.employee.mobile,
      row.cashGiven,
      row.cashReturned,
      row.approvedExpenses,
      row.pendingExpenses,
      row.pendingCount,
      row.balance,
      row.lastActivityOn,
    ]),
  );
};

export const exportStatementCsv = async (
  userId: string,
  query: StatementQueryInput,
): Promise<{ csv: string; employeeName: string }> => {
  const result = await statement(userId, query);
  await recordAudit({
    action: 'EXPORT',
    entityType: 'Statement',
    entityId: userId,
    entityLabel: result.employee.fullName,
  });

  const csv = toCsv(
    ['Date', 'Document', 'Particulars', 'Site', 'Received', 'Spent / Returned', 'Balance'],
    [
      [result.from, '', 'Opening balance', '', '', '', result.openingBalance],
      ...result.lines.map((line) => [
        line.date,
        line.documentNo,
        line.particulars,
        line.site,
        line.credit,
        line.debit,
        line.runningBalance,
      ]),
      [
        result.to,
        '',
        'Closing balance',
        '',
        result.totalCredit,
        result.totalDebit,
        result.closingBalance,
      ],
    ],
  );

  return { csv, employeeName: result.employee.fullName };
};
