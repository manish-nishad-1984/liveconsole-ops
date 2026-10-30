import type {
  LedgerClosureDto,
  LedgerClosurePreviewDto,
  LedgerOpeningDto,
} from '@liveconsole-ops/types';

import { BusinessRuleError, NotFoundError } from '../../lib/errors.js';
import { ZERO, formatDateOnly, money, todayInIndia } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { getActorId, requireOrg } from '../../lib/requestContext.js';
import { recordAudit } from '../../services/audit.service.js';
import { computeTotals } from '../../services/ledger.service.js';
import * as repository from './ledger-closures.repository.js';
import type { ClosureRecord } from './ledger-closures.repository.js';
import type { ClosureInput } from './ledger-closures.schema.js';

/**
 * Closing the books.
 *
 * An administrator draws a line under everything recorded so far: each
 * employee's balance is written as an opening figure, and the entries behind it
 * stop counting and stop appearing. The balance each person carries does not
 * change — it is simply carried as one number instead of hundreds of rows.
 *
 * Nothing is deleted. Every archived row keeps a pointer to the closure that
 * archived it, so undoing is one update per table and the figures return to
 * exactly what they were. That is deliberate: an administrator should be able to
 * try this, look at it, and change their mind.
 */

const toOpenings = (record: ClosureRecord): LedgerOpeningDto[] =>
  record.openings.map((opening) => ({
    employee: opening.employee,
    amount: money(opening.amount),
  }));

const toDto = (record: ClosureRecord): LedgerClosureDto => ({
  id: record.id,
  closedOn: formatDateOnly(record.closedOn),
  note: record.note,
  entryCount: record.entryCount,
  openingTotal: money(record.openingTotal),
  employeeCount: record.openings.length,
  reversedAt: record.reversedAt?.toISOString() ?? null,
  openings: toOpenings(record),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.createdAt.toISOString(),
  createdById: record.createdById,
  updatedById: null,
});

/**
 * Who would carry what. Only non-zero balances become openings — writing a row
 * of zero for everyone would say nothing and clutter every statement.
 */
const balancesToCarry = async (organizationId: string) => {
  const totals = await computeTotals(organizationId);
  const employeeIds = [...totals.keys()];
  const names =
    employeeIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, fullName: true },
        });
  const nameById = new Map(names.map((user) => [user.id, user.fullName]));

  const carried = employeeIds
    .map((employeeId) => ({
      employeeId,
      fullName: nameById.get(employeeId) ?? '—',
      balance: totals.get(employeeId)!.balance,
    }))
    .filter((row) => !row.balance.isZero())
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const total = carried.reduce((running, row) => running.plus(row.balance), ZERO);
  return { carried, total };
};

export const preview = async (): Promise<LedgerClosurePreviewDto> => {
  const organizationId = requireOrg();
  const [{ carried, total }, counts] = await Promise.all([
    balancesToCarry(organizationId),
    repository.countOpenEntries(organizationId),
  ]);

  return {
    closedOn: todayInIndia(),
    entryCount: counts.cashEntryCount + counts.expenseCount,
    cashEntryCount: counts.cashEntryCount,
    expenseCount: counts.expenseCount,
    openingTotal: money(total),
    openings: carried.map((row) => ({
      employee: { id: row.employeeId, fullName: row.fullName },
      amount: money(row.balance),
    })),
  };
};

export const list = async (): Promise<LedgerClosureDto[]> => {
  const organizationId = requireOrg();
  const records = await repository.listClosures(organizationId);
  return records.map(toDto);
};

export const create = async (input: ClosureInput): Promise<LedgerClosureDto> => {
  const organizationId = requireOrg();
  const actorId = getActorId()!;

  const counts = await repository.countOpenEntries(organizationId);
  if (counts.cashEntryCount + counts.expenseCount === 0) {
    throw new BusinessRuleError('There is nothing to close — no cash entries or expenses yet.');
  }

  // One transaction: the openings and the archiving have to land together, or a
  // balance would be counted twice or not at all.
  const closure = await prisma.$transaction(async (tx) => {
    const { carried, total } = await balancesToCarry(organizationId);
    const closedOn = todayInIndia();

    const created = await repository.createClosure(
      {
        organizationId,
        closedOn: new Date(`${closedOn}T00:00:00.000Z`),
        note: input.note ?? null,
        openingTotal: total,
        createdById: actorId,
      },
      tx,
    );

    if (carried.length > 0) {
      await repository.createOpenings(
        carried.map((row) => ({
          organizationId,
          closureId: created.id,
          employeeId: row.employeeId,
          amount: row.balance,
        })),
        tx,
      );
    }

    await repository.supersedeEarlierOpenings(organizationId, created.id, tx);
    const entryCount = await repository.archiveOpenEntries(organizationId, created.id, tx);
    const withCount = await tx.ledgerClosure.update({
      where: { id: created.id },
      data: { entryCount },
      select: repository.closureSelect,
    });

    await recordAudit({
      action: 'CREATE',
      entityType: 'LedgerClosure',
      entityId: created.id,
      entityLabel: `Books closed on ${closedOn}`,
      changes: {
        entriesArchived: { from: null, to: entryCount },
        employeesCarried: { from: null, to: carried.length },
        openingTotal: { from: null, to: money(total) },
      },
      db: tx,
    });

    return withCount;
  });

  return toDto(closure);
};

/** Undo. The entries come back and the openings stop counting. */
export const reverse = async (id: string): Promise<LedgerClosureDto> => {
  const organizationId = requireOrg();
  const actorId = getActorId()!;

  const existing = await repository.findClosure(organizationId, id);
  if (!existing) throw new NotFoundError('Closure');
  if (existing.reversedAt) throw new BusinessRuleError('This closure has already been undone.');

  const closure = await prisma.$transaction(async (tx) => {
    const released = await repository.releaseEntries(organizationId, id, tx);
    await repository.restoreSupersededOpenings(organizationId, id, tx);
    const updated = await repository.markReversed(id, actorId, tx);

    await recordAudit({
      action: 'DELETE',
      entityType: 'LedgerClosure',
      entityId: id,
      entityLabel: `Closure of ${formatDateOnly(existing.closedOn)} undone`,
      changes: { entriesReleased: { from: null, to: released } },
      db: tx,
    });

    return updated;
  });

  return toDto(closure);
};
