import type { Request, Response } from 'express';

import { ok, paginated } from '../../lib/http.js';
import type { AuditListQueryInput } from './audit.schema.js';
import * as auditService from './audit.service.js';

export const list = async (req: Request, res: Response): Promise<Response> => {
  const result = await auditService.list(req.query as unknown as AuditListQueryInput);
  return paginated(res, result.items, result.pagination);
};

export const listEntityTypes = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await auditService.listEntityTypes());
