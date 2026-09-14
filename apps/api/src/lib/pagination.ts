import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@liveconsole-ops/shared';
import type { PaginationMeta, SortDirection } from '@liveconsole-ops/types';

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginationArgs {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

/** Clamp untrusted paging input into something safe to hand to Prisma. */
export const resolvePagination = (input: PaginationInput): PaginationArgs => {
  const page = Math.max(1, Math.trunc(input.page ?? DEFAULT_PAGE));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(input.pageSize ?? DEFAULT_PAGE_SIZE)),
  );

  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
};

export const buildPaginationMeta = (
  total: number,
  { page, pageSize }: Pick<PaginationArgs, 'page' | 'pageSize'>,
): PaginationMeta => {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

/**
 * Resolve a client-supplied sort into a Prisma `orderBy`, rejecting anything not
 * on the module's allow-list. Without the allow-list, `sortBy` is an injection
 * point into the query shape.
 */
export const resolveOrderBy = <TField extends string>(
  sortBy: string | undefined,
  sortDir: SortDirection | undefined,
  allowed: readonly TField[],
  fallback: { field: TField; dir: SortDirection },
): Record<string, unknown> => {
  const direction: SortDirection = sortDir === 'asc' || sortDir === 'desc' ? sortDir : fallback.dir;
  const field = allowed.includes(sortBy as TField) ? (sortBy as TField) : fallback.field;

  // Dotted paths address a relation, e.g. `reportsTo.fullName`.
  if (field.includes('.')) {
    const [relation, nested] = field.split('.') as [string, string];
    return { [relation]: { [nested]: direction } };
  }

  return { [field]: direction };
};
