import { Prisma } from '@prisma/client';

/**
 * Money and calendar-date helpers.
 *
 * Amounts are Prisma `Decimal` end to end and leave the API as fixed two-place
 * strings; arithmetic never goes through a JavaScript float. Dates stored as
 * Postgres `date` come back as UTC-midnight `Date`s and leave as "YYYY-MM-DD".
 */

export const ZERO = new Prisma.Decimal(0);

export type DecimalLike = Prisma.Decimal | string | number | null | undefined;

export const toDecimal = (value: DecimalLike): Prisma.Decimal =>
  value === null || value === undefined ? ZERO : new Prisma.Decimal(value);

export const money = (value: DecimalLike): string => toDecimal(value).toFixed(2);

export const sum = (...values: DecimalLike[]): Prisma.Decimal =>
  values.reduce<Prisma.Decimal>((total, value) => total.plus(toDecimal(value)), ZERO);

/** "YYYY-MM-DD" → Date at UTC midnight, which is what a Postgres `date` column holds. */
export const parseDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export const formatDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

/** Today's date in India, as "YYYY-MM-DD" — the server itself may run in any zone. */
export const todayInIndia = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** First day of the current month in India. */
export const monthStartInIndia = (): string => `${todayInIndia().slice(0, 8)}01`;
