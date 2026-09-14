import type { Request, Response } from 'express';

import { csvFileName } from '../../lib/csv.js';
import { ok } from '../../lib/http.js';
import * as balancesService from './balances.service.js';
import type { BalanceListQueryInput, StatementQueryInput } from './balances.schema.js';

export const list = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await balancesService.list(req.query as unknown as BalanceListQueryInput));

export const statement = async (req: Request, res: Response): Promise<Response> =>
  ok(
    res,
    await balancesService.statement(
      req.params.userId!,
      req.query as unknown as StatementQueryInput,
    ),
  );

export const exportBalances = async (req: Request, res: Response): Promise<void> => {
  const csv = await balancesService.exportBalancesCsv(
    req.query as unknown as BalanceListQueryInput,
  );
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${csvFileName('balances')}"`,
  });
  res.send(csv);
};

export const exportStatement = async (req: Request, res: Response): Promise<void> => {
  const { csv, employeeName } = await balancesService.exportStatementCsv(
    req.params.userId!,
    req.query as unknown as StatementQueryInput,
  );
  const slug =
    employeeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'employee';
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${csvFileName(`statement-${slug}`)}"`,
  });
  res.send(csv);
};
