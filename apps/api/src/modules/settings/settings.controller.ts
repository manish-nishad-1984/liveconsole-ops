import type { Request, Response } from 'express';

import { ok } from '../../lib/http.js';
import * as settingsService from './settings.service.js';
import type { UpdateSettingsInput } from './settings.schema.js';

export const get = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await settingsService.get());

export const update = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await settingsService.update(req.body as UpdateSettingsInput));
