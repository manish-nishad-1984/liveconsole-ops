import type { Request, Response } from 'express';

import { csvFileName } from '../../lib/csv.js';
import { created, ok } from '../../lib/http.js';
import * as cashBookService from './cash-book.service.js';
import type {
  CashEntryInput,
  CashEntryListQueryInput,
  UpdateCashEntryInput,
} from './cash-book.schema.js';

/** The list carries filter totals beside the page, so it is returned via `ok`. */
export const list = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await cashBookService.list(req.query as unknown as CashEntryListQueryInput));

export const getById = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await cashBookService.getById(req.params.id!));

export const create = async (req: Request, res: Response): Promise<Response> =>
  created(res, await cashBookService.create(req.body as CashEntryInput));

export const update = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await cashBookService.update(req.params.id!, req.body as UpdateCashEntryInput));

export const remove = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await cashBookService.remove(req.params.id!));

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  const csv = await cashBookService.exportToCsv(req.query as unknown as CashEntryListQueryInput);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${csvFileName('cash-book')}"`,
  });
  res.send(csv);
};
