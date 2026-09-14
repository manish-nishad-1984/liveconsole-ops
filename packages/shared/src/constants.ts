/** Cross-cutting constants. Anything a magic number would otherwise be. */

export const APP_NAME = 'LiveConsole Ops';
export const APP_SLUG = 'liveconsole-ops';

export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_LOCALE = 'en-IN';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const FISCAL_YEAR_START_MONTH = 4;

/* ------------------------------------------------------------------ */
/* Listing defaults                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Patterns both sides validate against. Duplicating a regex between the form and
 * the API is how the two eventually disagree about what a valid value is.
 */
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  /** 10-digit Indian mobile. Swap for your locale's rule if that is not yours. */
  PHONE: /^[6-9]\d{9}$/,
  PINCODE: /^[1-9]\d{5}$/,
  SLUG: /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
} as const;

/**
 * Password policy, stated once. The API enforces it on every write and the web
 * strength meter reads the same list, so the meter can never promise something
 * the server will reject.
 */
export const PASSWORD_RULES = [
  { label: '8 characters or more', test: (value: string) => value.length >= 8 },
  { label: 'An uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'A lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'A number', test: (value: string) => /\d/.test(value) },
] as const;

export const meetsPasswordPolicy = (value: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.test(value));

/* ------------------------------------------------------------------ */
/* Document numbering                                                  */
/* ------------------------------------------------------------------ */

/**
 * Prefixes for human-readable document numbers, allocated atomically per
 * `(prefix, fiscalYear)` by the API's numbering service. Empty until your project
 * has its first numbered document — the mechanism is here, the vocabulary is not.
 */
export const DOC_PREFIX: Record<string, string> = {};
