import { Router } from 'express';

import { asyncHandler, ok } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';

export const healthRoutes = Router();

/** Liveness — the process is up. Deliberately does not touch the database. */
healthRoutes.get('/', (_req, res) => {
  ok(res, { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

/** Readiness — the process can actually serve traffic. */
healthRoutes.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    return ok(res, { status: 'ready', database: 'up' });
  }),
);
