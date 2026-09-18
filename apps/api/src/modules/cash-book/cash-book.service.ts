import type { CashBookListDto, CashEntryDto } from '@liveconsole-ops/types';

import { toCsv } from '../../lib/csv.js';
import { BusinessRuleError, NotFoundError } from '../../lib/errors.js';
import { formatDateOnly, money, parseDateOnly, todayInIndia, toDecimal } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { buildPaginationMeta } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { auditCreate, auditUpdate, getActorId, requireOrg } from '../../lib/requestContext.js';
import { diffRecords, recordAudit } from '../../services/audit.service.js';
import { employeeScope, findActiveEmployee, totalsFor } from '../../services/ledger.service.js';
import * as repository from './cash-book.repository.js';
import type { CashEntryRecord } from './cash-book.repository.js';
import type {
  CashEntryInput,
  CashEntryListQueryInput,
  UpdateCashEntryInput,
} from './cash-book.schema.js';

/**
 * The cash book: money an administrator hands to an employee (GIVEN) and unspent
 * money handed back (RETURNED).
 *
 * Rules:
 *  • An employee sees only their own entries; `cash_book:manage` sees everyone's.
 *  • Nobody can return more than they currently hold — a RETURNED entry larger
 *    than the balance is almost always a typo, and it would silently show the
 *    company owing the employee money.
 *  • Entries cannot be dated in the future.
 */

const DOCUMENT_PREFIX = 'CB';

const toDto = (entry: CashEntryRecord): CashEntryDto => ({
  id: entry.id,
  entryNo: entry.entryNo,
  type: entry.type,
  employee: entry.employee,
  site: entry.site,
  entryDate: formatDateOnly(entry.entryDate),
  amount: money(entry.amount),
  paymentMode: entry.paymentMode,
  referenceNo: entry.referenceNo,
  notes: entry.notes,
  handledBy: entry.handledBy,
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
  createdById: entry.createdById,
  updatedById: entry.updatedById,
});

const scope = () => employeeScope('cash_book:manage');

export const list = async (query: CashEntryListQueryInput): Promise<CashBookListDto> => {
  const organizationId = requireOrg();
  const [{ items, total, page, pageSize, totals }, spent] = await Promise.all([
    repository.listCashEntries(organizationId, query, scope()),
    // Bills follow the expense permission, not the cash book one, so a caller
    // never sees a total over expenses they could not list.
    repository.sumExpenses(organizationId, query, employeeScope('expenses:manage')),
  ]);

  const given = toDecimal(totals.find((row) => row.type === 'GIVEN')?._sum.amount);
  const returned = toDecimal(totals.find((row) => row.type === 'RETURNED')?._sum.amount);

  return {
    items: items.map(toDto),
    pagination: buildPaginationMeta(total, { page, pageSize }),
    totals: {
      given: money(given),
      returned: money(returned),
      net: money(given.minus(returned)),
      expenses: money(toDecimal(spent._sum.amount)),
      expenseCount: spent._count._all,
    },
  };
};

export const getById = async (id: string): Promise<CashEntryDto> => {
  const entry = await repository.findCashEntryById(requireOrg(), id, scope());
  if (!entry) throw new NotFoundError('Cash entry');
  return toDto(entry);
};

const assertNotFuture = (date: string) => {
  if (date > todayInIndia()) throw new BusinessRuleError('The date cannot be in the future');
};

const assertCanReturn = async (
  organizationId: string,
  employeeId: string,
  amount: string,
  excludeCashEntryId?: string,
) => {
  const { balance } = await totalsFor(organizationId, employeeId, {
    excludeCashEntryId,
  });
  if (toDecimal(amount).greaterThan(balance)) {
    throw new BusinessRuleError(
      `This employee holds only ₹${money(balance.isNegative() ? 0 : balance)} — they cannot return more than that`,
    );
  }
};

const assertReferences = async (
  organizationId: string,
  employeeId: string | undefined,
  siteId: string | null | undefined,
) => {
  if (employeeId && !(await findActiveEmployee(organizationId, employeeId))) {
    throw new BusinessRuleError('The selected employee is not an active user');
  }
  if (siteId && !(await repository.findActiveSite(organizationId, siteId))) {
    throw new BusinessRuleError('The selected site is not active');
  }
};

export const create = async (input: CashEntryInput): Promise<CashEntryDto> => {
  const organizationId = requireOrg();
  const actorId = getActorId()!;

  assertNotFuture(input.entryDate);
  await assertReferences(organizationId, input.employeeId, input.siteId);
  if (input.type === 'RETURNED') {
    await assertCanReturn(organizationId, input.employeeId, input.amount);
  }

  const entryDate = parseDateOnly(input.entryDate);

  const entry = await prisma.$transaction(async (tx) => {
    const entryNo = await nextDocumentNumber(tx, organizationId, DOCUMENT_PREFIX, entryDate);

    const createdEntry = await repository.createCashEntry(
      {
        organizationId,
        entryNo,
        type: input.type,
        employeeId: input.employeeId,
        siteId: input.siteId ?? null,
        entryDate,
        amount: input.amount,
        paymentMode: input.paymentMode,
        referenceNo: input.referenceNo ?? null,
        notes: input.notes ?? null,
        handledById: actorId,
        ...auditCreate(),
      },
      tx,
    );

    await recordAudit({
      action: 'CREATE',
      entityType: 'CashEntry',
      entityId: createdEntry.id,
      entityLabel: entryNo,
      changes: diffRecords(null, {
        type: createdEntry.type,
        employee: createdEntry.employee.fullName,
        amount: money(createdEntry.amount),
        paymentMode: createdEntry.paymentMode,
      }),
      db: tx,
    });

    return createdEntry;
  });

  return toDto(entry);
};

export const update = async (id: string, input: UpdateCashEntryInput): Promise<CashEntryDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findCashEntryById(organizationId, id, null);
  if (!existing) throw new NotFoundError('Cash entry');

  if (input.entryDate) assertNotFuture(input.entryDate);
  await assertReferences(
    organizationId,
    input.employeeId !== existing.employeeId ? input.employeeId : undefined,
    input.siteId !== existing.siteId ? input.siteId : undefined,
  );

  const type = input.type ?? existing.type;
  const employeeId = input.employeeId ?? existing.employeeId;
  const amount = input.amount ?? money(existing.amount);
  if (type === 'RETURNED') await assertCanReturn(organizationId, employeeId, amount, id);

  const entry = await repository.updateCashEntry(id, {
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.employeeId !== undefined ? { employeeId: input.employeeId } : {}),
    ...(input.siteId !== undefined ? { siteId: input.siteId } : {}),
    ...(input.entryDate !== undefined ? { entryDate: parseDateOnly(input.entryDate) } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.paymentMode !== undefined ? { paymentMode: input.paymentMode } : {}),
    ...(input.referenceNo !== undefined ? { referenceNo: input.referenceNo } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...auditUpdate(),
  });

  await recordAudit({
    action: 'UPDATE',
    entityType: 'CashEntry',
    entityId: id,
    entityLabel: entry.entryNo,
    changes: diffRecords(
      {
        ...toDto(existing),
        employee: existing.employee.fullName,
        site: existing.site?.name ?? null,
      },
      {
        ...toDto(entry),
        employee: entry.employee.fullName,
        site: entry.site?.name ?? null,
      },
    ),
  });

  return toDto(entry);
};

export const remove = async (id: string): Promise<CashEntryDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findCashEntryById(organizationId, id, null);
  if (!existing) throw new NotFoundError('Cash entry');

  const entry = await repository.updateCashEntry(id, {
    isActive: false,
    deletedAt: new Date(),
    ...auditUpdate(),
  });

  await recordAudit({
    action: 'DELETE',
    entityType: 'CashEntry',
    entityId: id,
    entityLabel: entry.entryNo,
    changes: { amount: { from: money(existing.amount), to: null } },
  });

  return toDto(entry);
};

export const exportToCsv = async (query: CashEntryListQueryInput): Promise<string> => {
  const entries = await repository.listAllCashEntries(requireOrg(), query, scope());

  await recordAudit({
    action: 'EXPORT',
    entityType: 'CashEntry',
    entityLabel: `${entries.length} rows`,
  });

  return toCsv(
    [
      'Entry No',
      'Date',
      'Type',
      'Employee',
      'Site',
      'Amount',
      'Mode',
      'Reference',
      'Notes',
      'Handled By',
    ],
    entries.map((entry) => [
      entry.entryNo,
      formatDateOnly(entry.entryDate),
      entry.type,
      entry.employee.fullName,
      entry.site?.name,
      money(entry.amount),
      entry.paymentMode,
      entry.referenceNo,
      entry.notes,
      entry.handledBy.fullName,
    ]),
  );
};
