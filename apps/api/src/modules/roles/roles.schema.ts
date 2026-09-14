import { ALL_PERMISSIONS } from '@liveconsole-ops/types';
import { z } from 'zod';

import { listQuery, optionalText, shortText } from '../../lib/validators.js';

/**
 * Only keys that exist in the TypeScript catalog are accepted — no free-form
 * permissions. A role can therefore never be granted something no route checks.
 */
const permissionKey = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

export const createRoleSchema = z.object({
  name: shortText(60),
  description: optionalText(240),
  permissions: z.array(permissionKey).min(1, 'Grant at least one permission'),
});

export const updateRoleSchema = z
  .object({
    name: shortText(60).optional(),
    description: optionalText(240),
    permissions: z.array(permissionKey).min(1, 'Grant at least one permission').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const roleListQuerySchema = listQuery;

export const ROLE_SORT_FIELDS = ['name', 'slug', 'createdAt'] as const;

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RoleListQueryInput = z.infer<typeof roleListQuerySchema>;
