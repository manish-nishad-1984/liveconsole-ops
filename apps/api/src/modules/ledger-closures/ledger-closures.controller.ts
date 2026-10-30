import type { Request, Response } from 'express';

import { created, ok } from '../../lib/http.js';
import * as service from './ledger-closures.service.js';

export const preview = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await service.preview());

export const list = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await service.list());

export const create = async (req: Request, res: Response): Promise<Response> =>
  created(res, await service.create(req.body));

export const reverse = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await service.reverse(req.params.id!));
