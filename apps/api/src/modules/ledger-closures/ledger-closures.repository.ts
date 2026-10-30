import type { Prisma } from '@prisma/client';

import { prisma, type Db } from '../../lib/prisma.js';

export const closureSelect = {
  id: true,
  closedOn: true,
  note: true,
  entryCount: true,
  openingTotal: true,
  reversedAt: true,
  createdAt: true,
  createdById: true,
  openings: {
    select: {
      amount: true,
      employee: { select: { id: true, fullName: true } },
    },
    orderBy: { employee: { fullName: 'asc' } },
  },
} satisfies Prisma.LedgerClosureSelect;

export type ClosureRecord = Prisma.LedgerClosureGetPayload<{ select: typeof closureSelect }>;

/** Newest first. A reversed closure stays in the list as a record of what was done. */
export const listClosures = (organizationId: string) =>
  prisma.ledgerClosure.findMany({
    where: { organizationId },
    select: closureSelect,
    orderBy: { createdAt: 'desc' },
  });

export const findClosure = (organizationId: string, id: string) =>
  prisma.ledgerClosure.findFirst({ where: { id, organizationId }, select: closureSelect });

export const createClosure = (data: Prisma.LedgerClosureUncheckedCreateInput, db: Db) =>
  db.ledgerClosure.create({ data, select: closureSelect });

export const createOpenings = (data: Prisma.LedgerOpeningCreateManyInput[], db: Db) =>
  db.ledgerOpening.createMany({ data });

/** Stamps everything still in the open period, which is what archives it. */
export const archiveOpenEntries = async (
  organizationId: string,
  closureId: string,
  db: Db,
): Promise<number> => {
  const [cash, expenses] = await Promise.all([
    db.cashEntry.updateMany({
      where: { organizationId, deletedAt: null, closureId: null },
      data: { closureId },
    }),
    db.expense.updateMany({
      where: { organizationId, deletedAt: null, closureId: null },
      data: { closureId },
    }),
  ]);
  return cash.count + expenses.count;
};

/** Undo: the rows go back to the open period and the openings stop counting. */
export const releaseEntries = async (
  organizationId: string,
  closureId: string,
  db: Db,
): Promise<number> => {
  const [cash, expenses] = await Promise.all([
    db.cashEntry.updateMany({ where: { organizationId, closureId }, data: { closureId: null } }),
    db.expense.updateMany({ where: { organizationId, closureId }, data: { closureId: null } }),
  ]);
  return cash.count + expenses.count;
};

export const markReversed = (id: string, reversedById: string, db: Db) =>
  db.ledgerClosure.update({
    where: { id },
    data: { reversedAt: new Date(), reversedById },
    select: closureSelect,
  });

/**
 * Rolls every standing opening into the new closure. The new openings were
 * computed from a balance that already included them, so leaving them live
 * would count the same money twice.
 */
export const supersedeEarlierOpenings = async (
  organizationId: string,
  closureId: string,
  db: Db,
): Promise<number> => {
  const { count } = await db.ledgerOpening.updateMany({
    where: { organizationId, supersededById: null, closureId: { not: closureId } },
    data: { supersededById: closureId },
  });
  return count;
};

/** Undo: the openings this closure rolled up start counting again. */
export const restoreSupersededOpenings = async (
  organizationId: string,
  closureId: string,
  db: Db,
): Promise<number> => {
  const { count } = await db.ledgerOpening.updateMany({
    where: { organizationId, supersededById: closureId },
    data: { supersededById: null },
  });
  return count;
};

/** How much is in the open period right now, for the preview. */
export const countOpenEntries = async (organizationId: string) => {
  const [cashEntryCount, expenseCount] = await Promise.all([
    prisma.cashEntry.count({ where: { organizationId, deletedAt: null, closureId: null } }),
    prisma.expense.count({ where: { organizationId, deletedAt: null, closureId: null } }),
  ]);
  return { cashEntryCount, expenseCount };
};
