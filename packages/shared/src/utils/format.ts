import { DEFAULT_LOCALE } from '../constants.js';

/**
 * Presentation helpers.
 *
 * Money never round-trips through a float: amounts arrive from the API as strings
 * (Postgres `Decimal` serialises that way) and are formatted from the string, not
 * parsed into a `number` and back.
 */

export const formatNumber = (
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions,
): string => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(numeric);
};

/**
 * Money as a plain figure — Indian grouping, always two decimals, and no ₹.
 * The whole app is one company in one currency, so the symbol on every row was
 * noise; the column heading says what the number is.
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
};

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** "3 minutes ago" / "in 2 days" — for audit trails and last-seen columns. */
export const formatRelative = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];

  const formatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' });

  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds || unit === 'second') {
      return formatter.format(Math.trunc(deltaSeconds / seconds), unit);
    }
  }

  return formatter.format(0, 'second');
};
