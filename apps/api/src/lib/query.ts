/**
 * Small composable helpers for building Prisma `where` clauses from list queries.
 * Repositories use these instead of hand-rolling the same null checks each time.
 */

type WhereFragment = Record<string, unknown>;

/** Case-insensitive `contains` across several columns, OR-ed together. */
export const searchAcross = (
  search: string | undefined,
  fields: readonly string[],
): WhereFragment | undefined => {
  const term = search?.trim();
  if (!term) return undefined;

  return {
    OR: fields.map((field) => {
      // Dotted paths search through a relation: `reportsTo.fullName`.
      if (field.includes('.')) {
        const [relation, nested] = field.split('.') as [string, string];
        return { [relation]: { [nested]: { contains: term, mode: 'insensitive' } } };
      }
      return { [field]: { contains: term, mode: 'insensitive' } };
    }),
  };
};

/** Inclusive date-range filter; either bound may be omitted. */
export const dateRange = (
  field: string,
  from?: string | Date | null,
  to?: string | Date | null,
): WhereFragment | undefined => {
  if (!from && !to) return undefined;

  const range: Record<string, Date> = {};
  if (from) range.gte = new Date(from);
  if (to) {
    // Push the upper bound to the end of the given day.
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return { [field]: range };
};

/** Emits `{ field: value }` only when the value is actually present. */
export const equals = (field: string, value: unknown): WhereFragment | undefined =>
  value === undefined || value === null || value === '' ? undefined : { [field]: value };

/** Accepts a single value or an array and emits an `in` filter. */
export const oneOf = (field: string, value: unknown): WhereFragment | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const values = Array.isArray(value) ? value.filter((entry) => entry !== '' && entry != null) : [value];
  if (values.length === 0) return undefined;
  return values.length === 1 ? { [field]: values[0] } : { [field]: { in: values } };
};

/** Drops the `undefined` fragments and AND-s the rest together. */
export const and = (...fragments: (WhereFragment | undefined)[]): WhereFragment => {
  const active = fragments.filter((fragment): fragment is WhereFragment => fragment !== undefined);
  if (active.length === 0) return {};
  if (active.length === 1) return active[0]!;
  return { AND: active };
};
