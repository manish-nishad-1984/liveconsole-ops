import { z } from 'zod';

import { booleanQuery, listQuery, optionalText, shortText } from '../../lib/validators.js';

export const siteSchema = z.object({
  name: shortText(120),
  location: optionalText(180),
  clientName: optionalText(120),
  notes: optionalText(1000),
  isActive: z.boolean().optional(),
});

export const updateSiteSchema = siteSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nothing to update',
  });

export const siteListQuerySchema = listQuery.extend({
  isActive: booleanQuery.optional(),
});

export const SITE_SORT_FIELDS = ['name', 'location', 'clientName', 'createdAt'] as const;

export type SiteInput = z.infer<typeof siteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type SiteListQueryInput = z.infer<typeof siteListQuerySchema>;
