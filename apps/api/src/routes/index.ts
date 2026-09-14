import { Router, type Router as ExpressRouter } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { auditRoutes } from '../modules/audit/audit.routes.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { balancesRoutes } from '../modules/balances/balances.routes.js';
import { cashBookRoutes } from '../modules/cash-book/cash-book.routes.js';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes.js';
import { expenseCategoriesRoutes } from '../modules/expense-categories/expense-categories.routes.js';
import { expensesRoutes } from '../modules/expenses/expenses.routes.js';
import { rolesRoutes } from '../modules/roles/roles.routes.js';
import { sitesRoutes } from '../modules/sites/sites.routes.js';
import { usersRoutes } from '../modules/users/users.routes.js';
import { healthRoutes } from './health.routes.js';

/**
 * The API route table.
 *
 * Two tiers only:
 *   • `/health` and `/auth` are reachable without a token (each auth route that
 *     does need one applies `authenticate` itself).
 *   • everything in `protectedRoutes` sits behind `authenticate`, and each
 *     individual route declares the permission it requires.
 *
 * Module routers are added here as their modules are built; the path segments
 * match the front-end routes in `packages/shared/src/modules.ts`.
 */

interface RouteRegistration {
  path: string;
  router: ExpressRouter;
}

const protectedRoutes: RouteRegistration[] = [
  { path: '/dashboard', router: dashboardRoutes },
  { path: '/users', router: usersRoutes },
  { path: '/roles', router: rolesRoutes },
  { path: '/audit-logs', router: auditRoutes },
  { path: '/expenses', router: expensesRoutes },
  { path: '/cash-book', router: cashBookRoutes },
  { path: '/balances', router: balancesRoutes },
  { path: '/sites', router: sitesRoutes },
  { path: '/expense-categories', router: expenseCategoriesRoutes },
];

export const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);

for (const { path, router } of protectedRoutes) {
  apiRouter.use(path, authenticate, router);
}
