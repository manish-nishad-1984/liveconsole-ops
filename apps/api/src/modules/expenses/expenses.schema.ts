import { PaymentMode } from '@prisma/client';
import { z } from 'zod';

import {
  amount,
  dateOnly,
  listQuery,
  optionalText,
  optionalUuid,
  uuid,
} from '../../lib/validators.js';

export const expenseSchema = z.object({
  /** Honoured only for `expenses:manage`; everyone else files for themselves. */
  employeeId: optionalUuid,
  siteId: optionalUuid,
  categoryId: uuid,
  expenseDate: dateOnly,
  amount,
  paymentMode: z.nativeEnum(PaymentMode).default('CASH'),
  paidTo: optionalText(120),
  /** "Remark" on screen — optional. */
  description: optionalText(500),
});

export const updateExpenseSchema = z
  .object({
    employeeId: uuid,
    siteId: optionalUuid,
    categoryId: uuid,
    expenseDate: dateOnly,
    amount,
    paymentMode: z.nativeEnum(PaymentMode),
    paidTo: optionalText(120),
    description: optionalText(500),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nothing to update',
  });

export const expenseListQuerySchema = listQuery.extend({
  employeeId: uuid.optional(),
  siteId: uuid.optional(),
  categoryId: uuid.optional(),
  paymentMode: z.nativeEnum(PaymentMode).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const attachmentParams = z.object({ id: uuid, attachmentId: uuid });

export const EXPENSE_SORT_FIELDS = [
  'expenseDate',
  'expenseNo',
  'amount',
  'createdAt',
  'employee.fullName',
  'site.name',
] as const;

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseListQueryInput = z.infer<typeof expenseListQuerySchema>;
