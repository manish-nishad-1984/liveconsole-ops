import type { ApiError } from '@liveconsole-ops/types';
import type { ErrorRequestHandler, RequestHandler } from 'express';

import { isProduction } from '../config/env.js';
import { AppError, NotFoundError, isAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { mapPrismaError } from '../lib/prisma.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError('Endpoint', `No route matches ${req.method} ${req.originalUrl}`));
};

/**
 * The single exit point for every failure. Nothing else in the codebase writes an
 * error response, which is what keeps the error envelope consistent and stops
 * internal messages from leaking to clients.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let resolved: AppError;

  if (isAppError(error)) {
    resolved = error;
  } else {
    const mapped = mapPrismaError(error);
    resolved = isAppError(mapped)
      ? mapped
      : new AppError(
          mapped?.message ?? 'Something went wrong on our side',
          mapped ? 409 : 500,
          mapped ? 'CONFLICT' : 'INTERNAL_ERROR',
          { isOperational: Boolean(mapped), cause: error },
        );
  }

  const logPayload = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    actorId: req.auth?.userId ?? null,
    statusCode: resolved.statusCode,
    code: resolved.code,
  };

  if (resolved.isOperational) {
    logger.warn(logPayload, resolved.message);
  } else {
    logger.error({ ...logPayload, err: error }, resolved.message);
  }

  const payload: ApiError = {
    success: false,
    error: {
      code: resolved.code,
      // Never surface the message of an unexpected failure.
      message:
        resolved.isOperational || !isProduction
          ? resolved.message
          : 'Something went wrong on our side',
      ...(resolved.details ? { details: resolved.details } : {}),
    },
  };

  res.status(resolved.statusCode).json(payload);
};
