import type { Request, Response } from 'express';

import { created, ok, paginated } from '../../lib/http.js';
import * as sitesService from './sites.service.js';
import type { SiteInput, SiteListQueryInput, UpdateSiteInput } from './sites.schema.js';

export const list = async (req: Request, res: Response): Promise<Response> => {
  const result = await sitesService.list(req.query as unknown as SiteListQueryInput);
  return paginated(res, result.items, result.pagination);
};

export const options = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await sitesService.options());

export const create = async (req: Request, res: Response): Promise<Response> =>
  created(res, await sitesService.create(req.body as SiteInput));

export const update = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await sitesService.update(req.params.id!, req.body as UpdateSiteInput));

export const remove = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await sitesService.remove(req.params.id!));
