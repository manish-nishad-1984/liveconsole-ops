import type { Request, Response } from 'express';

import { csvFileName } from '../../lib/csv.js';
import { created, noContent, ok } from '../../lib/http.js';
import * as expensesService from './expenses.service.js';
import type {
  ApproveInput,
  BulkApproveInput,
  ExpenseInput,
  ExpenseListQueryInput,
  RejectInput,
  UpdateExpenseInput,
} from './expenses.schema.js';

/** The list carries status totals beside the page, so it is returned via `ok`. */
export const list = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await expensesService.list(req.query as unknown as ExpenseListQueryInput));

export const getById = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await expensesService.getById(req.params.id!));

export const create = async (req: Request, res: Response): Promise<Response> =>
  created(res, await expensesService.create(req.body as ExpenseInput));

export const update = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await expensesService.update(req.params.id!, req.body as UpdateExpenseInput));

export const remove = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await expensesService.remove(req.params.id!));

export const approve = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await expensesService.approve(req.params.id!, req.body as ApproveInput));

export const reject = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await expensesService.reject(req.params.id!, req.body as RejectInput));

export const reopen = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await expensesService.reopen(req.params.id!));

export const bulkApprove = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await expensesService.bulkApprove(req.body as BulkApproveInput));

export const addAttachment = async (req: Request, res: Response): Promise<Response> =>
  created(res, await expensesService.addAttachment(req.params.id!, req.file!));

export const downloadAttachment = async (req: Request, res: Response): Promise<void> => {
  const { attachment, stream } = await expensesService.openAttachment(
    req.params.id!,
    req.params.attachmentId!,
  );

  const safeName = attachment.fileName.replace(/["\\\r\n]/g, '_');
  res.set({
    'Content-Type': attachment.mimeType,
    'Content-Length': String(attachment.sizeBytes),
    'Content-Disposition': `inline; filename="${safeName}"`,
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  stream.pipe(res);
};

export const removeAttachment = async (req: Request, res: Response): Promise<Response> => {
  await expensesService.removeAttachment(req.params.id!, req.params.attachmentId!);
  return noContent(res);
};

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  const csv = await expensesService.exportToCsv(req.query as unknown as ExpenseListQueryInput);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${csvFileName('expenses')}"`,
  });
  res.send(csv);
};
