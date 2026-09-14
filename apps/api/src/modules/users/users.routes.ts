import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { uuidParam } from '../../lib/validators.js';
import { requirePermission } from '../../middleware/authorize.js';
import { heavyOperationLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import {
  createUserSchema,
  setPasswordSchema,
  setStatusSchema,
  updateUserSchema,
  userListQuerySchema,
} from './users.schema.js';

/**
 * `authenticate` is applied once for the whole protected router in
 * `src/routes/index.ts`; each route below declares only the permission it needs.
 */
export const usersRoutes = Router();

usersRoutes.get(
  '/',
  requirePermission('users:view'),
  validate({ query: userListQuerySchema }),
  asyncHandler(controller.list),
);

/** Picker endpoint — any authenticated user may resolve names for assignment. */
usersRoutes.get('/assignable', asyncHandler(controller.listAssignable));

/** Branch list for the user form's picker; same reasoning as `/assignable`. */
usersRoutes.get('/branches', asyncHandler(controller.listBranches));

/** Employee picker for cash entries, expenses and filters; same reasoning. */
usersRoutes.get('/options', asyncHandler(controller.listOptions));

usersRoutes.get(
  '/export',
  requirePermission('users:export'),
  heavyOperationLimiter,
  validate({ query: userListQuerySchema }),
  asyncHandler(controller.exportCsv),
);

usersRoutes.get(
  '/:id',
  requirePermission('users:view'),
  validate({ params: uuidParam }),
  asyncHandler(controller.getById),
);

usersRoutes.post(
  '/',
  requirePermission('users:create'),
  validate({ body: createUserSchema }),
  asyncHandler(controller.create),
);

usersRoutes.patch(
  '/:id',
  requirePermission('users:update'),
  validate({ params: uuidParam, body: updateUserSchema }),
  asyncHandler(controller.update),
);

usersRoutes.post(
  '/:id/status',
  requirePermission('users:update'),
  validate({ params: uuidParam, body: setStatusSchema }),
  asyncHandler(controller.setStatus),
);

/** Setting somebody else's password is its own permission, not part of update. */
usersRoutes.post(
  '/:id/password',
  requirePermission('users:manage'),
  validate({ params: uuidParam, body: setPasswordSchema }),
  asyncHandler(controller.setPassword),
);

/** Soft delete — the account is disabled and its sessions are revoked. */
usersRoutes.delete(
  '/:id',
  requirePermission('users:delete'),
  validate({ params: uuidParam }),
  asyncHandler(controller.remove),
);
