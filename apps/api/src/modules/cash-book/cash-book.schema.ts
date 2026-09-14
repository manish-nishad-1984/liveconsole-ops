import { CashEntryType, PaymentMode } from '@prisma/client';
import { z } from 'zod';

import {
  amount,
  dateOnly,
  listQuery,
  optionalText,
  optionalUuid,
  uuid,
} from '../../lib/validators.js';

export const cashEntrySchema = z.object({
  type: z.nativeEnum(CashEntryType).default('GIVEN'),
  employeeId: uuid,
  siteId: optionalUuid,
  entryDate: dateOnly,
  amount,
  paymentMode: z.nativeEnum(PaymentMode).default('CASH'),
  referenceNo: optionalText(80),
  notes: optionalText(500),
});

export const updateCashEntrySchema = z
  .object({
    type: z.nativeEnum(CashEntryType),
    employeeId: uuid,
    siteId: optionalUuid,
    entryDate: dateOnly,
    amount,
    paymentMode: z.nativeEnum(PaymentMode),
    referenceNo: optionalText(80),
    notes: optionalText(500),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nothing to update',
  });

export const cashEntryListQuerySchema = listQuery.extend({
  type: z.nativeEnum(CashEntryType).optional(),
  employeeId: uuid.optional(),
  siteId: uuid.optional(),
  paymentMode: z.nativeEnum(PaymentMode).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const CASH_ENTRY_SORT_FIELDS = [
  'entryDate',
  'entryNo',
  'amount',
  'createdAt',
  'employee.fullName',
] as const;

export type CashEntryInput = z.infer<typeof cashEntrySchema>;
export type UpdateCashEntryInput = z.infer<typeof updateCashEntrySchema>;
export type CashEntryListQueryInput = z.infer<typeof cashEntryListQuerySchema>;
