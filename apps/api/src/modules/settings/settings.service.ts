import type { OrgSettingsDto } from '@liveconsole-ops/types';

import { prisma } from '../../lib/prisma.js';
import { auditUpdate, requireOrg } from '../../lib/requestContext.js';
import { diffRecords, recordAudit } from '../../services/audit.service.js';
import type { UpdateSettingsInput } from './settings.schema.js';

/**
 * Tenant settings — the few rules an administrator may change without a release.
 *
 * Each one is a row in `CompanySetting` keyed by the constants below, read
 * through `get()` so an unset key falls back to its default rather than to
 * undefined. There is no settings *table* in the domain sense: a setting exists
 * because a rule reads it, and that rule owns its default.
 */

export const KEYS = {
  expenseBackdateDays: 'expenses.backdateDays',
} as const;

/**
 * How many days back an ordinary employee may date an expense, counting today as
 * 0 — the default lets them file today, yesterday and the day before. Their site
 * work is filed from a phone, often a day or two late; older than that and the
 * office wants to see it before it lands in a balance.
 */
export const DEFAULT_EXPENSE_BACKDATE_DAYS = 2;

const MAX_BACKDATE_DAYS = 365;

const readNumber = async (
  organizationId: string,
  key: string,
  fallback: number,
): Promise<number> => {
  const row = await prisma.companySetting.findUnique({
    where: { organizationId_key: { organizationId, key } },
    select: { value: true },
  });
  if (row === null) return fallback;

  const value = Number(row.value);
  return Number.isFinite(value) ? value : fallback;
};

/** The window rule, for the expense service and for the DTO flags it produces. */
export const expenseBackdateDays = (organizationId: string): Promise<number> =>
  readNumber(organizationId, KEYS.expenseBackdateDays, DEFAULT_EXPENSE_BACKDATE_DAYS);

export const get = async (): Promise<OrgSettingsDto> => {
  const organizationId = requireOrg();
  return {
    expenseBackdateDays: await expenseBackdateDays(organizationId),
    maxExpenseBackdateDays: MAX_BACKDATE_DAYS,
  };
};

export const update = async (input: UpdateSettingsInput): Promise<OrgSettingsDto> => {
  const organizationId = requireOrg();
  const before = await get();

  if (input.expenseBackdateDays !== undefined) {
    await prisma.companySetting.upsert({
      where: { organizationId_key: { organizationId, key: KEYS.expenseBackdateDays } },
      create: {
        organizationId,
        key: KEYS.expenseBackdateDays,
        value: input.expenseBackdateDays,
        scope: 'EXPENSES',
        dataType: 'number',
        description: 'Days back an employee may date an expense (0 = today only).',
        ...auditUpdate(),
      },
      update: { value: input.expenseBackdateDays, ...auditUpdate() },
    });
  }

  const after = await get();

  await recordAudit({
    action: 'UPDATE',
    entityType: 'CompanySetting',
    entityLabel: 'Settings',
    changes: diffRecords({ ...before }, { ...after }),
  });

  return after;
};
