import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { uuidParam } from '../../lib/validators.js';
import { requirePermission } from '../../middleware/authorize.js';
import { heavyOperationLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './cash-book.controller.js';
import {
  cashEntryListQuerySchema,
  cashEntrySchema,
  updateCashEntrySchema,
} from './cash-book.schema.js';

/**
 * Viewing is scoped in the service (own entries unless `cash_book:manage`).
 * Writing is an administrator's job, so create/update/delete are only granted to
 * administrator roles.
 */
export const cashBookRoutes = Router();

cashBookRoutes.get(
  '/',
  requirePermission('cash_book:view'),
  validate({ query: cashEntryListQuerySchema }),
  asyncHandler(controller.list),
);

cashBookRoutes.get(
  '/export',
  requirePermission('cash_book:export'),
  heavyOperationLimiter,
  validate({ query: cashEntryListQuerySchema }),
  asyncHandler(controller.exportCsv),
);

cashBookRoutes.get(
  '/:id',
  requirePermission('cash_book:view'),
  validate({ params: uuidParam }),
  asyncHandler(controller.getById),
);

cashBookRoutes.post(
  '/',
  requirePermission('cash_book:create'),
  validate({ body: cashEntrySchema }),
  asyncHandler(controller.create),
);

cashBookRoutes.patch(
  '/:id',
  requirePermission('cash_book:update'),
  validate({ params: uuidParam, body: updateCashEntrySchema }),
  asyncHandler(controller.update),
);

cashBookRoutes.delete(
  '/:id',
  requirePermission('cash_book:delete'),
  validate({ params: uuidParam }),
  asyncHandler(controller.remove),
);
