import type { Request, Response } from 'express';

import { csvFileName } from '../../lib/csv.js';
import { created, ok } from '../../lib/http.js';
import * as rentalsService from './vehicle-rentals.service.js';
import type {
  PaymentInput,
  RentalInput,
  RentalListQueryInput,
  UpdatePaymentInput,
  UpdateRentalInput,
} from './vehicle-rentals.schema.js';

/** The list carries filter totals beside the page, so it is returned via `ok`. */
export const list = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await rentalsService.list(req.query as unknown as RentalListQueryInput));

export const suggestions = async (_req: Request, res: Response): Promise<Response> =>
  ok(res, await rentalsService.suggestions());

export const getById = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await rentalsService.getById(req.params.id!));

export const create = async (req: Request, res: Response): Promise<Response> =>
  created(res, await rentalsService.create(req.body as RentalInput));

export const update = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await rentalsService.update(req.params.id!, req.body as UpdateRentalInput));

export const remove = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await rentalsService.remove(req.params.id!));

/** Payment writes return the whole rental, so its totals refresh with them. */
export const addPayment = async (req: Request, res: Response): Promise<Response> =>
  created(res, await rentalsService.addPayment(req.params.id!, req.body as PaymentInput));

export const updatePayment = async (req: Request, res: Response): Promise<Response> =>
  ok(
    res,
    await rentalsService.updatePayment(
      req.params.id!,
      req.params.paymentId!,
      req.body as UpdatePaymentInput,
    ),
  );

export const removePayment = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await rentalsService.removePayment(req.params.id!, req.params.paymentId!));

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  const csv = await rentalsService.exportToCsv(req.query as unknown as RentalListQueryInput);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${csvFileName('vehicle-rentals')}"`,
  });
  res.send(csv);
};
