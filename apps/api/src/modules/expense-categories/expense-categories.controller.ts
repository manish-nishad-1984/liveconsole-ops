import type { Request, Response } from 'express';

import { created, ok, paginated } from '../../lib/http.js';
import * as categoriesService from './expense-categories.service.js';
import type {
  CategoryInput,
  CategoryListQueryInput,
  UpdateCategoryInput,
} from './expense-categories.schema.js';

export const list = async (req: Request, res: Response): Promise<Response> => {
  const result = await categoriesService.list(req.query as unknown as CategoryListQueryInput);
  return paginated(res, result.items, result.pagination);
};

export const options = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await categoriesService.options());

export const create = async (req: Request, res: Response): Promise<Response> =>
  created(res, await categoriesService.create(req.body as CategoryInput));

export const update = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await categoriesService.update(req.params.id!, req.body as UpdateCategoryInput));

export const remove = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await categoriesService.remove(req.params.id!));
