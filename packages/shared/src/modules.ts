import type { ModuleKey, PermissionKey } from '@liveconsole-ops/types';

/**
 * The module registry.
 *
 * This array drives navigation, the generated route table and the route guards at
 * once. Adding a module is an entry here plus its actions in `MODULE_PERMISSIONS`
 * — never an edit to the router, because the router *generates* itself from this
 * list and pairs every path with `module.permission`. A module therefore cannot
 * be mounted without its guard.
 *
 * `icon` is a lucide-react icon *name*, resolved to a component on the web side
 * (`src/lib/icons.ts`). Keeping it a string is what lets this package stay
 * framework-agnostic and be imported by the API as well.
 */

export type NavGroupKey = 'general' | 'petty_cash' | 'masters' | 'admin';

export interface NavGroup {
  key: NavGroupKey;
  label: string;
  /** A group of one renders its single item flat, with no heading. */
  standalone?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  { key: 'general', label: 'General', standalone: true },
  { key: 'petty_cash', label: 'Petty Cash' },
  { key: 'masters', label: 'Masters' },
  { key: 'admin', label: 'Administration' },
];

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  singular: string;
  path: string;
  /** A lucide-react icon name, resolved on the web side. */
  icon: string;
  group: NavGroupKey;
  order: number;
  /** The nav-guard permission. Holding it is what makes the item visible. */
  permission: PermissionKey;
  description: string;
  hiddenInNav?: boolean;
}

export const MODULES: ModuleDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    singular: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    group: 'general',
    order: 1,
    permission: 'dashboard:view',
    description: 'Cash with employees, pending approvals and this month at a glance.',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    singular: 'Expense',
    path: '/expenses',
    icon: 'Receipt',
    group: 'petty_cash',
    order: 10,
    permission: 'expenses:view',
    description: 'Site expenses with receipts, submitted for approval.',
  },
  {
    key: 'cash_book',
    label: 'Cash Book',
    singular: 'Cash Entry',
    path: '/cash-book',
    icon: 'Wallet',
    group: 'petty_cash',
    order: 11,
    permission: 'cash_book:view',
    description: 'Cash and UPI handed to employees, and cash returned.',
  },
  {
    key: 'balances',
    label: 'Balances',
    singular: 'Balance',
    path: '/balances',
    icon: 'Scale',
    group: 'petty_cash',
    order: 12,
    permission: 'balances:view',
    description: 'What each employee holds, with a running statement.',
  },
  {
    key: 'sites',
    label: 'Sites',
    singular: 'Site',
    path: '/sites',
    icon: 'MapPin',
    group: 'masters',
    order: 50,
    permission: 'sites:view',
    description: 'Work sites that expenses and vehicles are booked against.',
  },
  {
    key: 'expense_categories',
    label: 'Expense Categories',
    singular: 'Expense Category',
    path: '/expense-categories',
    icon: 'Tags',
    group: 'masters',
    order: 51,
    permission: 'expense_categories:view',
    description: 'What money is spent on — fuel, food, material…',
  },
  {
    key: 'users',
    label: 'Users',
    singular: 'User',
    path: '/users',
    icon: 'Users',
    group: 'admin',
    order: 90,
    permission: 'users:view',
    description: 'People with access.',
  },
  {
    key: 'roles',
    label: 'Roles',
    singular: 'Role',
    path: '/roles',
    icon: 'ShieldCheck',
    group: 'admin',
    order: 91,
    permission: 'roles:view',
    description: 'Permission sets.',
  },
  {
    key: 'audit_logs',
    label: 'Audit Log',
    singular: 'Audit Entry',
    path: '/audit-logs',
    icon: 'History',
    group: 'admin',
    order: 92,
    permission: 'audit_logs:view',
    description: 'Who did what, when.',
  },
  // <-- your project appends its real modules here as they are built.
];

export const getModule = (key: ModuleKey): ModuleDefinition | undefined =>
  MODULES.find((module) => module.key === key);

export const getNavGroup = (key: NavGroupKey): NavGroup | undefined =>
  NAV_GROUPS.find((group) => group.key === key);

export const getModulesByGroup = (group: NavGroupKey): ModuleDefinition[] =>
  MODULES.filter((module) => module.group === group && !module.hiddenInNav).sort(
    (a, b) => a.order - b.order,
  );

/**
 * Longest path first, so `/inventory/transfers` resolves to the transfers module
 * rather than to `/inventory` — a plain `startsWith` scan would pick whichever
 * came first in the array.
 */
export const getModuleByPath = (path: string): ModuleDefinition | undefined =>
  [...MODULES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((module) => path === module.path || path.startsWith(`${module.path}/`));

export type NavNode =
  | { type: 'item'; module: ModuleDefinition }
  | { type: 'group'; group: NavGroup; modules: ModuleDefinition[] };

/**
 * The sidebar tree, filtered by what the viewer may open.
 *
 * A group whose every module is hidden does not render its heading either — an
 * empty "Administration" label reads as a broken screen rather than as a
 * permission boundary.
 */
export const buildNavTree = (canAccess: (module: ModuleDefinition) => boolean): NavNode[] => {
  const nodes: NavNode[] = [];

  for (const group of NAV_GROUPS) {
    const modules = getModulesByGroup(group.key).filter(canAccess);
    if (modules.length === 0) continue;

    if (group.standalone) {
      for (const module of modules) nodes.push({ type: 'item', module });
    } else {
      nodes.push({ type: 'group', group, modules });
    }
  }

  return nodes;
};
