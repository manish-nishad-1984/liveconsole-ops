import type { Request, Response } from 'express';

import { created, ok, paginated } from '../../lib/http.js';
import * as usersService from './users.service.js';
import type {
  CreateUserInput,
  SetPasswordInput,
  SetStatusInput,
  UpdateUserInput,
  UserListQueryInput,
} from './users.schema.js';

/**
 * Controllers stay thin on purpose: read validated input, call one service method,
 * shape the response. No Prisma, no business rules, no cross-module orchestration.
 */

export const list = async (req: Request, res: Response): Promise<Response> => {
  const result = await usersService.list(req.query as unknown as UserListQueryInput);
  return paginated(res, result.items, result.pagination);
};

export const getById = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await usersService.getById(req.params.id!));

export const create = async (req: Request, res: Response): Promise<Response> =>
  created(res, await usersService.create(req.body as CreateUserInput));

export const update = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await usersService.update(req.params.id!, req.body as UpdateUserInput));

export const setStatus = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await usersService.setStatus(req.params.id!, req.body as SetStatusInput));

export const setPassword = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await usersService.setPassword(req.params.id!, req.body as SetPasswordInput));

export const remove = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await usersService.remove(req.params.id!));

export const listAssignable = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await usersService.listAssignable(req.query.search as string | undefined));

export const listBranches = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await usersService.listBranches());

export const listOptions = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await usersService.listOptions());

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  const csv = await usersService.exportToCsv(req.query as unknown as UserListQueryInput);

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
  res.send(csv);
};
