import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './audit.controller.js';
import { auditListQuerySchema } from './audit.schema.js';

export const auditRoutes = Router();

auditRoutes.get(
  '/',
  requirePermission('audit_logs:view'),
  validate({ query: auditListQuerySchema }),
  asyncHandler(controller.list),
);

auditRoutes.get(
  '/entity-types',
  requirePermission('audit_logs:view'),
  asyncHandler(controller.listEntityTypes),
);
