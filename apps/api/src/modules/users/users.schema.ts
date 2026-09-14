import { UserStatus } from '@prisma/client';
import { z } from 'zod';

import {
  booleanQuery,
  email,
  listQuery,
  optionalText,
  optionalUuid,
  password,
  phone,
  shortText,
  uuid,
} from '../../lib/validators.js';

export const createUserSchema = z.object({
  fullName: shortText(120),
  email,
  phone: z.union([phone, z.literal('')]).nullish(),
  employeeCode: optionalText(30),
  designation: optionalText(80),
  branchId: optionalUuid,
  reportsToId: optionalUuid,
  roleIds: z.array(uuid).min(1, 'Assign at least one role'),
  /** Omit to create an INVITED account with a generated temporary password. */
  password: password.optional(),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .extend({
    status: z.nativeEnum(UserStatus).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

/** ACTIVE / SUSPENDED / DISABLED, as its own permissioned action. */
export const setStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

/** Administrative reset — does not require the user's current password. */
export const setPasswordSchema = z.object({
  /** Omit to have the server generate one and return it exactly once. */
  password: password.optional(),
  mustChangePassword: z.boolean().optional().default(true),
});

export const userListQuerySchema = listQuery.extend({
  status: z.nativeEnum(UserStatus).optional(),
  roleId: uuid.optional(),
  branchId: uuid.optional(),
  isActive: booleanQuery.optional(),
});

export const USER_SORT_FIELDS = [
  'fullName',
  'email',
  'employeeCode',
  'designation',
  'status',
  'lastLoginAt',
  'createdAt',
] as const;

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SetStatusInput = z.infer<typeof setStatusSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type UserListQueryInput = z.infer<typeof userListQuerySchema>;
