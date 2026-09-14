import { FISCAL_YEAR_START_MONTH } from '@liveconsole-ops/shared';
import { Prisma } from '@prisma/client';

import type { Db } from './prisma.js';

/**
 * Document numbers: `<prefix>/<fiscal year>/<0001>`, e.g. `EX/2026-27/0042`.
 *
 * The counter is advanced inside the caller's transaction, so the number and the
 * document commit together — a rolled-back write does not burn a number, and two
 * documents created at the same moment cannot share one.
 */

/** Indian fiscal year of a date: April 2026 → "2026-27". */
export const fiscalYearOf = (date: Date, startMonth = FISCAL_YEAR_START_MONTH): string => {
  const month = date.getUTCMonth() + 1;
  const startYear = month >= startMonth ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

export const nextDocumentNumber = async (
  db: Db,
  organizationId: string,
  prefix: string,
  documentDate: Date,
): Promise<string> => {
  const fiscalYear = fiscalYearOf(documentDate);
  const where = {
    organizationId_prefix_fiscalYear: { organizationId, prefix, fiscalYear },
  };

  const advance = () =>
    db.numberSequence.upsert({
      where,
      create: { organizationId, prefix, fiscalYear, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
      select: { nextValue: true, padTo: true },
    });

  let sequence;
  try {
    sequence = await advance();
  } catch (error) {
    // Two first-documents-of-the-year racing to create the row: one loses on the
    // unique key, and by then the row exists, so the retry is a plain increment.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      sequence = await advance();
    } else {
      throw error;
    }
  }

  const value = String(sequence.nextValue - 1).padStart(sequence.padTo, '0');
  return `${prefix}/${fiscalYear}/${value}`;
};
