import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { uuidParam } from '../../lib/validators.js';
import { requirePermission } from '../../middleware/authorize.js';
import { heavyOperationLimiter } from '../../middleware/rateLimit.js';
import { singleFile } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './expenses.controller.js';
import {
  approveSchema,
  attachmentParams,
  bulkApproveSchema,
  expenseListQuerySchema,
  expenseSchema,
  rejectSchema,
  updateExpenseSchema,
} from './expenses.schema.js';

/**
 * Route permissions say what kind of action this is; the service then decides
 * whose record it may be done to (own vs. everyone's) and whether the expense's
 * status still allows it.
 */
export const expensesRoutes = Router();

expensesRoutes.get(
  '/',
  requirePermission('expenses:view'),
  validate({ query: expenseListQuerySchema }),
  asyncHandler(controller.list),
);

expensesRoutes.get(
  '/export',
  requirePermission('expenses:export'),
  heavyOperationLimiter,
  validate({ query: expenseListQuerySchema }),
  asyncHandler(controller.exportCsv),
);

expensesRoutes.post(
  '/bulk-approve',
  requirePermission('expenses:approve'),
  validate({ body: bulkApproveSchema }),
  asyncHandler(controller.bulkApprove),
);

expensesRoutes.get(
  '/:id',
  requirePermission('expenses:view'),
  validate({ params: uuidParam }),
  asyncHandler(controller.getById),
);

expensesRoutes.post(
  '/',
  requirePermission('expenses:create'),
  validate({ body: expenseSchema }),
  asyncHandler(controller.create),
);

expensesRoutes.patch(
  '/:id',
  requirePermission('expenses:update'),
  validate({ params: uuidParam, body: updateExpenseSchema }),
  asyncHandler(controller.update),
);

expensesRoutes.delete(
  '/:id',
  requirePermission('expenses:delete'),
  validate({ params: uuidParam }),
  asyncHandler(controller.remove),
);

expensesRoutes.post(
  '/:id/approve',
  requirePermission('expenses:approve'),
  validate({ params: uuidParam, body: approveSchema }),
  asyncHandler(controller.approve),
);

expensesRoutes.post(
  '/:id/reject',
  requirePermission('expenses:approve'),
  validate({ params: uuidParam, body: rejectSchema }),
  asyncHandler(controller.reject),
);

expensesRoutes.post(
  '/:id/reopen',
  requirePermission('expenses:approve'),
  validate({ params: uuidParam }),
  asyncHandler(controller.reopen),
);

/* Receipts */

expensesRoutes.post(
  '/:id/attachments',
  requirePermission('expenses:create', 'expenses:update'),
  validate({ params: uuidParam }),
  singleFile('file'),
  asyncHandler(controller.addAttachment),
);

expensesRoutes.get(
  '/:id/attachments/:attachmentId',
  requirePermission('expenses:view'),
  validate({ params: attachmentParams }),
  asyncHandler(controller.downloadAttachment),
);

expensesRoutes.delete(
  '/:id/attachments/:attachmentId',
  requirePermission('expenses:create', 'expenses:update'),
  validate({ params: attachmentParams }),
  asyncHandler(controller.removeAttachment),
);
