import type { Paginated, PaginationMeta } from '@liveconsole-ops/types';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Single place that shapes the success envelope. */
export const ok = <T>(res: Response, data: T, meta?: Record<string, unknown>): Response =>
  res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });

export const created = <T>(res: Response, data: T): Response =>
  res.status(201).json({ success: true, data });

export const noContent = (res: Response): Response => res.status(204).send();

export const paginated = <T>(res: Response, items: T[], pagination: PaginationMeta): Response => {
  const payload: Paginated<T> = { items, pagination };
  return res.status(200).json({ success: true, data: payload });
};

/**
 * Wraps async handlers so a rejected promise reaches Express' error pipeline.
 * Express 4 does not await handlers; without this every `await` needs try/catch.
 */
export const asyncHandler =
  <TReq extends Request = Request>(
    handler: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    void handler(req as TReq, res, next).catch(next);
  };
