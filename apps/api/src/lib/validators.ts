import { MAX_PAGE_SIZE, REGEX } from '@liveconsole-ops/shared';
import { z } from 'zod';

/**
 * Reusable Zod primitives. Module schemas compose these instead of restating the
 * same regexes, so a change to (say) the password policy lands everywhere at once.
 */

export const uuid = z.string().uuid('Must be a valid identifier');

export const uuidParam = z.object({ id: uuid });

export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(180);

/**
 * The password *policy* — enforced wherever a password is set, never on sign-in
 * (an existing weak password must still be able to log in).
 */
export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/\d/, 'Include at least one number');

export const phone = z
  .string()
  .trim()
  .regex(REGEX.PHONE, 'Enter a valid 10-digit mobile number');

export const pincode = z.string().trim().regex(REGEX.PINCODE, 'Enter a valid 6-digit PIN code');

/** Trimmed, non-empty string with a sane upper bound. */
export const shortText = (max = 180) => z.string().trim().min(1, 'This field is required').max(max);
export const longText = (max = 5000) => z.string().trim().max(max);

/** Optional field that treats `''` from a form as "not provided". */
export const optionalText = (max = 180) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullish();

export const optionalUuid = z
  .union([uuid, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullish();

/** Query params arrive as strings; `'true'` must become `true`. */
export const booleanQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

/**
 * Base shape for every list endpoint. Modules extend it with their own filters:
 *   `listQuery.extend({ status: z.nativeEnum(UserStatus).optional() })`
 */
export const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(25),
  search: z.string().trim().max(120).optional(),
  sortBy: z.string().trim().max(60).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export type ListQueryInput = z.infer<typeof listQuery>;

/** Coerce a repeated query param into an array (`?status=A&status=B`). */
export const arrayOf = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema)]).transform((value) => (Array.isArray(value) ? value : [value]));
