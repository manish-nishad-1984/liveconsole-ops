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
  'APPROVE',
  'REJECT',
  'EXPORT',
  'IMPORT',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const PAYMENT_MODES = ['CASH', 'UPI', 'BANK'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** GIVEN: cash handed to an employee. RETURNED: unspent cash handed back. */
export const CASH_ENTRY_TYPES = ['GIVEN', 'RETURNED'] as const;
export type CashEntryType = (typeof CASH_ENTRY_TYPES)[number];

export const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
