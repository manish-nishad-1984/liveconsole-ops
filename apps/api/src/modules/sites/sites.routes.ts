import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { uuidParam } from '../../lib/validators.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './sites.controller.js';
import { siteListQuerySchema, siteSchema, updateSiteSchema } from './sites.schema.js';

export const sitesRoutes = Router();

sitesRoutes.get(
  '/',
  requirePermission('sites:view'),
  validate({ query: siteListQuerySchema }),
  asyncHandler(controller.list),
);

/** Picker endpoint — every signed-in user books expenses against a site. */
sitesRoutes.get('/options', asyncHandler(controller.options));

sitesRoutes.post(
  '/',
  requirePermission('sites:create'),
  validate({ body: siteSchema }),
  asyncHandler(controller.create),
);

sitesRoutes.patch(
  '/:id',
  requirePermission('sites:update'),
  validate({ params: uuidParam, body: updateSiteSchema }),
  asyncHandler(controller.update),
);

sitesRoutes.delete(
  '/:id',
  requirePermission('sites:delete'),
  validate({ params: uuidParam }),
  asyncHandler(controller.remove),
);
