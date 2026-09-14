import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { uuidParam } from '../../lib/validators.js';
import { requirePermission } from '../../middleware/authorize.js';
import { heavyOperationLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './vehicle-rentals.controller.js';
import {
  paymentParams,
  paymentSchema,
  rentalListQuerySchema,
  rentalSchema,
  updatePaymentSchema,
  updateRentalSchema,
} from './vehicle-rentals.schema.js';

/**
 * Viewing is scoped in the service: the rentals a user is in charge of, or every
 * rental with `transport:manage`. Payments are part of a rental, so recording or
 * changing one needs `transport:update` and deleting one `transport:delete`.
 */
export const vehicleRentalsRoutes = Router();

vehicleRentalsRoutes.get(
  '/',
  requirePermission('transport:view'),
  validate({ query: rentalListQuerySchema }),
  asyncHandler(controller.list),
);

vehicleRentalsRoutes.get(
  '/export',
  requirePermission('transport:export'),
  heavyOperationLimiter,
  validate({ query: rentalListQuerySchema }),
  asyncHandler(controller.exportCsv),
);

vehicleRentalsRoutes.get(
  '/suggestions',
  requirePermission('transport:view'),
  asyncHandler(controller.suggestions),
);

vehicleRentalsRoutes.get(
  '/:id',
  requirePermission('transport:view'),
  validate({ params: uuidParam }),
  asyncHandler(controller.getById),
);

vehicleRentalsRoutes.post(
  '/',
  requirePermission('transport:create'),
  validate({ body: rentalSchema }),
  asyncHandler(controller.create),
);

vehicleRentalsRoutes.patch(
  '/:id',
  requirePermission('transport:update'),
  validate({ params: uuidParam, body: updateRentalSchema }),
  asyncHandler(controller.update),
);

vehicleRentalsRoutes.delete(
  '/:id',
  requirePermission('transport:delete'),
  validate({ params: uuidParam }),
  asyncHandler(controller.remove),
);

vehicleRentalsRoutes.post(
  '/:id/payments',
  requirePermission('transport:update'),
  validate({ params: uuidParam, body: paymentSchema }),
  asyncHandler(controller.addPayment),
);

vehicleRentalsRoutes.patch(
  '/:id/payments/:paymentId',
  requirePermission('transport:update'),
  validate({ params: paymentParams, body: updatePaymentSchema }),
  asyncHandler(controller.updatePayment),
);

vehicleRentalsRoutes.delete(
  '/:id/payments/:paymentId',
  requirePermission('transport:delete'),
  validate({ params: paymentParams }),
  asyncHandler(controller.removePayment),
);
