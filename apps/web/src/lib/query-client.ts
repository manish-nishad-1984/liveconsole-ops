import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiRequestError } from './api-client';

/**
 * One QueryClient for the app.
 *
 * Failed *mutations* surface a toast automatically — a user who clicks Save must
 * always learn whether it worked. Failed *queries* do not, because screens render
 * their own ErrorState with a retry affordance in place of the content.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Auth, permission and validation failures will not fix themselves.
        if (error instanceof ApiRequestError && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only complain about background refetch failures once data is on screen.
      if (query.state.data !== undefined && error instanceof ApiRequestError) {
        toast.error('Could not refresh this data', {
          description: error.message,
        });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (!(error instanceof ApiRequestError)) {
        toast.error('Something went wrong', {
          description: 'Please try again.',
        });
        return;
      }
      // Field-level validation is rendered inline on the form, not as a toast.
      if (error.code === 'VALIDATION_ERROR' && error.details?.length) return;
      if (error.isAuthError) return;

      toast.error(error.code === 'FORBIDDEN' ? 'Not permitted' : 'Could not save your changes', {
        description: error.message,
      });
    },
  }),
});

/**
 * Query key factory.
 *
 * Centralising keys keeps invalidation honest: a mutation invalidates
 * `queryKeys.users.all` and every list and detail under it refreshes, with no
 * string literals scattered across features. Add a block per module.
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    sessions: ['auth', 'sessions'] as const,
  },
  dashboard: {
    all: ['petty-cash', 'dashboard'] as const,
    summary: ['petty-cash', 'dashboard', 'summary'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params: object) => ['users', 'list', params] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
    assignable: (search?: string) => ['users', 'assignable', search ?? ''] as const,
    branches: ['users', 'branches'] as const,
  },
  roles: {
    all: ['roles'] as const,
    list: (params: object) => ['roles', 'list', params] as const,
    detail: (id: string) => ['roles', 'detail', id] as const,
    permissionCatalog: ['roles', 'permission-catalog'] as const,
  },
  auditLogs: {
    all: ['audit-logs'] as const,
    list: (params: object) => ['audit-logs', 'list', params] as const,
    entityTypes: ['audit-logs', 'entity-types'] as const,
  },
  sites: {
    all: ['sites'] as const,
    list: (params: object) => ['sites', 'list', params] as const,
    options: ['sites', 'options'] as const,
  },
  expenseCategories: {
    all: ['expense-categories'] as const,
    list: (params: object) => ['expense-categories', 'list', params] as const,
    options: ['expense-categories', 'options'] as const,
  },
  employees: {
    options: ['users', 'options'] as const,
  },
  /**
   * Every petty cash write moves a balance, so cash book, expenses, balances and
   * the dashboard are invalidated together through `pettyCash.all`.
   */
  pettyCash: {
    all: ['petty-cash'] as const,
    cashBook: (params: object) => ['petty-cash', 'cash-book', params] as const,
    expenses: (params: object) => ['petty-cash', 'expenses', params] as const,
    expense: (id: string) => ['petty-cash', 'expense', id] as const,
    balances: (params: object) => ['petty-cash', 'balances', params] as const,
    statement: (userId: string, params: object) =>
      ['petty-cash', 'statement', userId, params] as const,
  },
  /**
   * Vehicle rentals sit under the petty cash prefix on purpose: a rent payment
   * from petty cash is an expense, so reviewing that expense changes what a rental
   * shows as paid, and recording a payment changes balances and the dashboard.
   */
  transport: {
    all: ['petty-cash', 'vehicle-rentals'] as const,
    list: (params: object) => ['petty-cash', 'vehicle-rentals', 'list', params] as const,
    detail: (id: string) => ['petty-cash', 'vehicle-rentals', 'detail', id] as const,
    suggestions: ['petty-cash', 'vehicle-rentals', 'suggestions'] as const,
  },
} as const;
