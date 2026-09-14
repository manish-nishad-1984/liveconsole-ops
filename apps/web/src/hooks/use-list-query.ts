import { DEFAULT_PAGE_SIZE } from '@liveconsole-ops/shared';
import type { SortDirection } from '@liveconsole-ops/types';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List-screen state, stored in the URL rather than in component state.
 *
 * Every module list shares this hook, which buys three things a `useState`
 * version cannot: a filtered view is shareable as a link, the browser Back button
 * steps through filter changes, and a reload keeps the user where they were. It
 * also means the query key derives from the URL, so TanStack Query caches per
 * view for free.
 */

export interface ListQueryState {
  page: number;
  pageSize: number;
  search: string;
  sortBy?: string;
  sortDir?: SortDirection;
  /** Module-specific filters, as raw strings from the URL. */
  filters: Record<string, string>;
}

export interface UseListQueryResult extends ListQueryState {
  /** Flat object to hand straight to the API service. */
  params: Record<string, string | number>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setSort: (sortBy: string, sortDir: SortDirection) => void;
  toggleSort: (sortBy: string) => void;
  setFilter: (key: string, value: string | null) => void;
  setFilters: (values: Record<string, string | null>) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
}

/** Reserved keys — everything else in the URL is treated as a module filter. */
const RESERVED = new Set(['page', 'pageSize', 'search', 'sortBy', 'sortDir']);

export const useListQuery = (options?: {
  defaultSortBy?: string;
  defaultSortDir?: SortDirection;
  defaultPageSize?: number;
}): UseListQueryResult => {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo<ListQueryState>(() => {
    const filters: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (!RESERVED.has(key) && value !== '') filters[key] = value;
    }

    const sortDir = searchParams.get('sortDir');

    return {
      page: Number(searchParams.get('page') ?? 1) || 1,
      pageSize: Number(
        searchParams.get('pageSize') ?? options?.defaultPageSize ?? DEFAULT_PAGE_SIZE,
      ),
      search: searchParams.get('search') ?? '',
      sortBy: searchParams.get('sortBy') ?? options?.defaultSortBy,
      sortDir:
        sortDir === 'asc' || sortDir === 'desc' ? sortDir : (options?.defaultSortDir ?? undefined),
      filters,
    };
  }, [searchParams, options?.defaultPageSize, options?.defaultSortBy, options?.defaultSortDir]);

  /**
   * Apply a patch to the URL. `resetPage` is the default because changing a
   * filter while on page 7 of the old result set is never what the user meant.
   */
  const patch = useCallback(
    (updates: Record<string, string | number | null>, resetPage = true) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);

          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, String(value));
          }

          if (resetPage && !('page' in updates)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const params = useMemo<Record<string, string | number>>(() => {
    const result: Record<string, string | number> = {
      page: state.page,
      pageSize: state.pageSize,
    };
    if (state.search) result.search = state.search;
    if (state.sortBy) result.sortBy = state.sortBy;
    if (state.sortDir) result.sortDir = state.sortDir;
    Object.assign(result, state.filters);
    return result;
  }, [state]);

  const activeFilterCount = Object.keys(state.filters).length;

  return {
    ...state,
    params,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0 || state.search.length > 0,

    setPage: (page) => patch({ page }, false),
    setPageSize: (pageSize) => patch({ pageSize }),
    setSearch: (search) => patch({ search: search || null }),
    setSort: (sortBy, sortDir) => patch({ sortBy, sortDir }, false),

    toggleSort: (sortBy) => {
      const isSameColumn = state.sortBy === sortBy;
      const nextDir: SortDirection = isSameColumn && state.sortDir === 'asc' ? 'desc' : 'asc';
      patch({ sortBy, sortDir: nextDir }, false);
    },

    setFilter: (key, value) => patch({ [key]: value }),
    setFilters: (values) => patch(values),

    clearFilters: () => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams();
          // Sorting and page size are view preferences, not filters — keep them.
          for (const key of ['pageSize', 'sortBy', 'sortDir']) {
            const value = current.get(key);
            if (value) next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
  };
};
