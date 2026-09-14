import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { uuidParam } from '../../lib/validators.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './expense-categories.controller.js';
import {
  categoryListQuerySchema,
  categorySchema,
  updateCategorySchema,
} from './expense-categories.schema.js';

export const expenseCategoriesRoutes = Router();

expenseCategoriesRoutes.get(
  '/',
  requirePermission('expense_categories:view'),
  validate({ query: categoryListQuerySchema }),
  asyncHandler(controller.list),
);

/** Picker endpoint — every signed-in user categorises their expenses. */
expenseCategoriesRoutes.get('/options', asyncHandler(controller.options));

expenseCategoriesRoutes.post(
  '/',
  requirePermission('expense_categories:create'),
  validate({ body: categorySchema }),
  asyncHandler(controller.create),
);

expenseCategoriesRoutes.patch(
  '/:id',
  requirePermission('expense_categories:update'),
  validate({ params: uuidParam, body: updateCategorySchema }),
  asyncHandler(controller.update),
);

expenseCategoriesRoutes.delete(
  '/:id',
  requirePermission('expense_categories:delete'),
  validate({ params: uuidParam }),
  asyncHandler(controller.remove),
);
