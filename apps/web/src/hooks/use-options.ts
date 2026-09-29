import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-client';
import {
  employeesService,
  expenseCategoriesService,
  settingsService,
  sitesService,
} from '@/services/masters.service';

/**
 * Picker data. These lists are short and change rarely, so they are cached for
 * five minutes and shared by every form and filter that needs them.
 */

const OPTIONS_STALE_MS = 5 * 60_000;

export const useSiteOptions = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.sites.options,
    queryFn: () => sitesService.options(),
    staleTime: OPTIONS_STALE_MS,
    enabled,
  });

export const useCategoryOptions = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.expenseCategories.options,
    queryFn: () => expenseCategoriesService.options(),
    staleTime: OPTIONS_STALE_MS,
    enabled,
  });

export const useEmployeeOptions = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.employees.options,
    queryFn: () => employeesService.options(),
    staleTime: OPTIONS_STALE_MS,
    enabled,
  });

/**
 * Tenant settings. The expense form needs the backdating window to set its date
 * picker's lower bound, so this is fetched wherever that form is, not only on
 * the settings screen.
 */
export const useOrgSettings = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => settingsService.get(),
    staleTime: OPTIONS_STALE_MS,
    enabled,
  });
