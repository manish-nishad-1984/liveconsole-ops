import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { uuidParam } from '../../lib/validators.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './roles.controller.js';
import { createRoleSchema, roleListQuerySchema, updateRoleSchema } from './roles.schema.js';

export const rolesRoutes = Router();

rolesRoutes.get(
  '/',
  requirePermission('roles:view'),
  validate({ query: roleListQuerySchema }),
  asyncHandler(controller.list),
);

/**
 * The full permission matrix — needed to render the role editor. Read from the
 * TypeScript catalog, not the database, so it can never offer a permission that
 * no route actually checks.
 */
rolesRoutes.get(
  '/permission-catalog',
  requirePermission('roles:view'),
  asyncHandler(controller.getPermissionCatalog),
);

rolesRoutes.get(
  '/:id',
  requirePermission('roles:view'),
  validate({ params: uuidParam }),
  asyncHandler(controller.getById),
);

rolesRoutes.post(
  '/',
  requirePermission('roles:create'),
  validate({ body: createRoleSchema }),
  asyncHandler(controller.create),
);

rolesRoutes.patch(
  '/:id',
  requirePermission('roles:update'),
  validate({ params: uuidParam, body: updateRoleSchema }),
  asyncHandler(controller.update),
);

rolesRoutes.delete(
  '/:id',
  requirePermission('roles:delete'),
  validate({ params: uuidParam }),
  asyncHandler(controller.remove),
);
