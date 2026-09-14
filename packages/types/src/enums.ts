/**
 * Enum mirrors.
 *
 * Prisma generates these too, but the web app must not import from
 * `@prisma/client` — that would drag the query engine into the browser bundle.
 * These are the same values, declared once for both sides.
 */

export const USER_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'PERMISSION_CHANGE',
  'STATUS_CHANGE',
  'EXPORT',
  'IMPORT',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
