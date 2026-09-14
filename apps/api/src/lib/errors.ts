import type { ApiFieldError, ErrorCode } from '@liveconsole-ops/types';

/**
 * Every error the API deliberately produces is an `AppError`. The error handler
 * maps it straight to the `ApiError` envelope; anything that is *not* an AppError
 * is treated as a bug and reported as INTERNAL_ERROR without leaking its message.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: ApiFieldError[];
  /** False for genuine bugs — the handler logs those at error level. */
  readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    options?: { details?: ApiFieldError[]; isOperational?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(details: ApiFieldError[], message = 'The submitted data is invalid') {
    super(message, 422, 'VALIDATION_ERROR', { details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Session expired, please sign in again') {
    super(message, 401, 'TOKEN_EXPIRED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', message?: string) {
    super(message ?? `${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'This record conflicts with an existing one') {
    super(message, 409, 'CONFLICT');
  }
}

/** Request was well-formed but violates a business rule. */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422, 'UNPROCESSABLE');
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
