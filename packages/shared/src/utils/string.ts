/** Small string helpers used on both sides of the wire. */

/** `Site Manager` → `site_manager`. Role slugs are generated with this. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** `Ada Lovelace` → `AL`; falls back to a single character. */
export const initials = (name: string | null | undefined, max = 2): string => {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

export const truncate = (value: string | null | undefined, length = 60): string => {
  if (!value) return '';
  return value.length <= length ? value : `${value.slice(0, length - 1).trimEnd()}…`;
};

export const digitsOnly = (value: string | null | undefined): string =>
  value ? value.replace(/\D/g, '') : '';

export const normaliseEmail = (value: string): string => value.trim().toLowerCase();

/** Safe filename for generated exports. */
export const toFileSlug = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
