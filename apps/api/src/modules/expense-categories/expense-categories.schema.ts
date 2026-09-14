import { z } from 'zod';

import { booleanQuery, listQuery, optionalText, shortText } from '../../lib/validators.js';

export const categorySchema = z.object({
  name: shortText(80),
  description: optionalText(300),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = categorySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nothing to update',
  });

export const categoryListQuerySchema = listQuery.extend({
  isActive: booleanQuery.optional(),
});

export const CATEGORY_SORT_FIELDS = ['name', 'sortOrder', 'createdAt'] as const;

export type CategoryInput = z.infer<typeof categorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryListQueryInput = z.infer<typeof categoryListQuerySchema>;
