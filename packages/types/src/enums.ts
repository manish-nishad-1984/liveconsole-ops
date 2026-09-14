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

/** PER_DAY: rate × days on rent. FIXED: rate is the whole rent. */
export const RENT_BASES = ['PER_DAY', 'FIXED'] as const;
export type RentBasis = (typeof RENT_BASES)[number];

/** OFFICE: paid by the company. PETTY_CASH: paid by an employee from cash they hold. */
export const RENT_PAYMENT_SOURCES = ['OFFICE', 'PETTY_CASH'] as const;
export type RentPaymentSource = (typeof RENT_PAYMENT_SOURCES)[number];

/** Derived from rent due and payments counted so far. */
export const RENT_PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID'] as const;
export type RentPaymentStatus = (typeof RENT_PAYMENT_STATUSES)[number];

/** Derived from the rental dates against today. */
export const RENTAL_STATUSES = ['UPCOMING', 'ON_RENT', 'COMPLETED'] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];
