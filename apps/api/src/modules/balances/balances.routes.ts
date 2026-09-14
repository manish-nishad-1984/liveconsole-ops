import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { heavyOperationLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './balances.controller.js';
import {
  balanceListQuerySchema,
  statementParams,
  statementQuerySchema,
} from './balances.schema.js';

export const balancesRoutes = Router();

balancesRoutes.get(
  '/',
  requirePermission('balances:view'),
  validate({ query: balanceListQuerySchema }),
  asyncHandler(controller.list),
);

balancesRoutes.get(
  '/export',
  requirePermission('balances:export'),
  heavyOperationLimiter,
  validate({ query: balanceListQuerySchema }),
  asyncHandler(controller.exportBalances),
);

balancesRoutes.get(
  '/:userId/statement',
  requirePermission('balances:view'),
  validate({ params: statementParams, query: statementQuerySchema }),
  asyncHandler(controller.statement),
);

balancesRoutes.get(
  '/:userId/statement/export',
  requirePermission('balances:export'),
  heavyOperationLimiter,
  validate({ params: statementParams, query: statementQuerySchema }),
  asyncHandler(controller.exportStatement),
);
