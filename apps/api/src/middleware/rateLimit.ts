import rateLimit, { type Options } from 'express-rate-limit';

import { isTest } from '../config/env.js';

const shared: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Rate limiting would make integration tests flaky and order-dependent.
  skip: () => isTest,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
    });
  },
};

/** Broad ceiling for the whole API surface. */
export const apiLimiter = rateLimit({ ...shared, windowMs: 60_000, limit: 300 });

/**
 * Credential endpoints get a much tighter budget, keyed on IP + identifier so one
 * account being attacked does not lock the whole office out of the login page.
 */
export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => {
    const identifier =
      typeof req.body?.identifier === 'string'
        ? req.body.identifier.trim().toLowerCase()
        : 'unknown';
    return `${req.ip}:${identifier}`;
  },
});

/** Password reset requests, to stop the endpoint being used as a mail cannon. */
export const passwordResetLimiter = rateLimit({ ...shared, windowMs: 60 * 60_000, limit: 5 });

/** Exports are expensive; keep them from monopolising the connection pool. */
export const heavyOperationLimiter = rateLimit({ ...shared, windowMs: 60_000, limit: 20 });
