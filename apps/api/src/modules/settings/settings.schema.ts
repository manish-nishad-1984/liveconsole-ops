import { z } from 'zod';

export const updateSettingsSchema = z
  .object({
    expenseBackdateDays: z.coerce
      .number()
      .int('Enter a whole number of days')
      .min(0, 'Cannot be less than 0')
      .max(365, 'Cannot be more than 365 days'),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
