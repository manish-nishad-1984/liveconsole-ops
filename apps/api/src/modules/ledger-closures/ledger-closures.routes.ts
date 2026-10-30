import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './ledger-closures.controller.js';
import { closureParams, closureSchema } from './ledger-closures.schema.js';

export const ledgerClosuresRoutes = Router();

/**
 * Closing the books is an administrator's decision about everybody's figures at
 * once, so all four routes are permissioned — unlike settings, nothing here is
 * readable by an employee filing an expense.
 */
ledgerClosuresRoutes.get(
  '/preview',
  requirePermission('ledger_closures:view'),
  asyncHandler(controller.preview),
);

ledgerClosuresRoutes.get('/', requirePermission('ledger_closures:view'), asyncHandler(controller.list));

ledgerClosuresRoutes.post(
  '/',
  requirePermission('ledger_closures:create'),
  validate({ body: closureSchema }),
  asyncHandler(controller.create),
);

/** Undo. Spelled DELETE because that is what it means to the administrator. */
ledgerClosuresRoutes.delete(
  '/:id',
  requirePermission('ledger_closures:delete'),
  validate({ params: closureParams }),
  asyncHandler(controller.reverse),
);
