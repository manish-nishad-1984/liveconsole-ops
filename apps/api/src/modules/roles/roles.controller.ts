import type { Request, Response } from 'express';

import { created, noContent, ok, paginated } from '../../lib/http.js';
import type { CreateRoleInput, RoleListQueryInput, UpdateRoleInput } from './roles.schema.js';
import * as rolesService from './roles.service.js';

export const list = async (req: Request, res: Response): Promise<Response> => {
  const result = await rolesService.list(req.query as unknown as RoleListQueryInput);
  return paginated(res, result.items, result.pagination);
};

export const getPermissionCatalog = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, rolesService.getPermissionCatalog());

export const getById = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await rolesService.getById(req.params.id!));

export const create = async (req: Request, res: Response): Promise<Response> =>
  created(res, await rolesService.create(req.body as CreateRoleInput));

export const update = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await rolesService.update(req.params.id!, req.body as UpdateRoleInput));

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await rolesService.remove(req.params.id!);
  return noContent(res);
};
