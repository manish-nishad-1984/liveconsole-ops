import type { ApiFieldError } from '@liveconsole-ops/types';
import type { Request, RequestHandler } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

import { ValidationError } from '../lib/errors.js';

/**
 * Zod is the only validation layer. Handlers receive already-parsed, already-typed
 * input — they never re-check `req.body`, and they never see a field the schema
 * did not declare, because the parsed result replaces the raw one.
 */

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const toFieldErrors = (error: ZodError): ApiFieldError[] =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    message: issue.message,
  }));

export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // `req.query` is a getter in Express 4; assign onto it rather than replace.
        Object.defineProperty(req, 'query', {
          value: schemas.query.parse(req.query),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError(toFieldErrors(error)));
        return;
      }
      next(error);
    }
  };

/** Typed accessors so controllers get inference without casting at each use. */
export const body = <T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> =>
  req.body as z.infer<T>;

export const query = <T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> =>
  req.query as unknown as z.infer<T>;
