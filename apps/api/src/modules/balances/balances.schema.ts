import { z } from 'zod';

import { dateOnly, uuid } from '../../lib/validators.js';

export const balanceListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export const statementParams = z.object({ userId: uuid });

export const statementQuerySchema = z
  .object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: '"From" must be on or before "To"',
    path: ['from'],
  });

export type BalanceListQueryInput = z.infer<typeof balanceListQuerySchema>;
export type StatementQueryInput = z.infer<typeof statementQuerySchema>;
