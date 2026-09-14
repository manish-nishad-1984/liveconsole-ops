import { MODULES } from '@liveconsole-ops/shared';
import type { ModuleKey } from '@liveconsole-ops/types';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { RouteObject } from 'react-router-dom';

import { ModuleGuard } from '@/app/guards';

/**
 * Module routes, generated from the shared registry.
 *
 * Every module gets its path, its permission guard and a page component looked up
 * in `MODULE_PAGES`. Two consequences are the point of doing it this way: a module
 * can never be mounted without its guard, and adding one means a registry entry
 * plus a line in the map below — never a change to the router itself.
 *
 * The trailing `/*` on each path lets a module own its nested detail and edit
 * routes in its own route file, rather than growing this one to a hundred entries.
 */

type ModulePage = LazyExoticComponent<ComponentType>;

const ModulePlaceholder = lazy(() => import('@/pages/ModulePlaceholder'));

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const UsersListPage = lazy(() => import('@/pages/users/UsersListPage'));
const RolesListPage = lazy(() => import('@/pages/roles/RolesListPage'));
const AuditLogsPage = lazy(() => import('@/pages/audit-logs/AuditLogsPage'));
const ExpensesListPage = lazy(() => import('@/pages/expenses/ExpensesListPage'));
const CashBookPage = lazy(() => import('@/pages/cash-book/CashBookPage'));
const BalancesRoutes = lazy(() => import('@/pages/balances/BalancesRoutes'));
const VehicleRentalsPage = lazy(() => import('@/pages/vehicle-rentals/VehicleRentalsPage'));
const SitesListPage = lazy(() => import('@/pages/sites/SitesListPage'));
const ExpenseCategoriesPage = lazy(
  () => import('@/pages/expense-categories/ExpenseCategoriesPage'),
);

/**
 * Implemented module pages. Anything absent falls back to `ModulePlaceholder`,
 * which states plainly that the module is not built yet rather than rendering an
 * empty screen that reads as broken.
 */
const MODULE_PAGES: Partial<Record<ModuleKey, ModulePage>> = {
  dashboard: DashboardPage,
  users: UsersListPage,
  roles: RolesListPage,
  audit_logs: AuditLogsPage,
  expenses: ExpensesListPage,
  cash_book: CashBookPage,
  balances: BalancesRoutes,
  transport: VehicleRentalsPage,
  sites: SitesListPage,
  expense_categories: ExpenseCategoriesPage,
};

export const moduleRoutes: RouteObject[] = MODULES.map((module) => {
  const Page = MODULE_PAGES[module.key] ?? ModulePlaceholder;

  return {
    path: `${module.path.replace(/^\//, '')}/*`,
    element: (
      <ModuleGuard moduleKey={module.key}>
        <Page />
      </ModuleGuard>
    ),
  };
});

/** Module keys that currently render a real page — used by the placeholder copy. */
export const IMPLEMENTED_MODULES = Object.keys(MODULE_PAGES) as ModuleKey[];
