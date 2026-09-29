import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './settings.controller.js';
import { updateSettingsSchema } from './settings.schema.js';

export const settingsRoutes = Router();

/**
 * Readable by anyone signed in: the expense form has to know how far back it may
 * let its date picker go, and an employee with no settings permission still
 * files expenses. Changing one needs `company_settings:update`.
 */
settingsRoutes.get('/', asyncHandler(controller.get));

settingsRoutes.patch(
  '/',
  requirePermission('company_settings:update'),
  validate({ body: updateSettingsSchema }),
  asyncHandler(controller.update),
);
