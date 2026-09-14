import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

import { runWithContext } from '../lib/requestContext.js';

/**
 * Opens the AsyncLocalStorage scope for the request and stamps a correlation id.
 * Must be mounted before any route that reads ambient context (which is all of
 * them, because the audit trail does).
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  runWithContext(
    {
      requestId,
      actorId: null,
      actorEmail: null,
      organizationId: null,
      // Filled in by `authenticate`. Empty until then, so an unauthenticated
      // request can never be mistaken for one that holds everything.
      permissions: new Set(),
      isSuperAdmin: false,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    },
    () => next(),
  );
};
