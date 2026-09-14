import type { Request, Response } from 'express';

import { ok } from '../../lib/http.js';
import * as dashboardService from './dashboard.service.js';

export const summary = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await dashboardService.getSummary());
