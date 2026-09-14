import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import * as controller from './dashboard.controller.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/', requirePermission('dashboard:view'), asyncHandler(controller.summary));
