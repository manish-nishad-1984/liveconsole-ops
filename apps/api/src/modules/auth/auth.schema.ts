import { z } from 'zod';

import { email, optionalText, password, phone, shortText } from '../../lib/validators.js';

export const loginSchema = z.object({
  /**
   * Email or mobile — not validated as either shape here. A malformed identifier
   * has to fail as "those sign-in details are incorrect" like every other bad
   * sign-in; a 422 saying "that is not a valid email" would tell an attacker
   * which of the two fields to keep guessing at.
   */
  identifier: z.string().trim().min(1, 'Enter your email address or mobile number').max(180),
  // Deliberately not the `password` policy schema — an existing weak password
  // must still be able to sign in; the policy is enforced when one is *set*.
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().optional().default(false),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'This reset link is not valid'),
  password,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: password,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'The new password must be different from the current one',
  });

/**
 * Self-service profile edit. The field list *is* the policy: anything absent here
 * cannot be changed by its owner, only by someone holding `users:update`.
 */
export const updateProfileSchema = z.object({
  fullName: shortText(120),
  phone: z.union([phone, z.literal('')]).nullish(),
  avatarUrl: optionalText(500),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
