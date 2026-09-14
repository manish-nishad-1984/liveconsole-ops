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
        toast.error('Could not refresh this data', { description: error.message });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (!(error instanceof ApiRequestError)) {
        toast.error('Something went wrong', { description: 'Please try again.' });
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
    all: ['dashboard'] as const,
    summary: ['dashboard', 'summary'] as const,
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
} as const;
