import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiRequestError } from '@/lib/api-client';

/**
 * Turning a failed request into something a form can show.
 *
 * Four failures reach a form and they are not interchangeable: a validation error
 * belongs on the field that caused it, a business-rule or permission error belongs
 * at the top of the form, an auth error is handled globally by the API client, and
 * a server error must never show its own message — a stack trace or a Postgres
 * constraint name is not an instruction to the user.
 */

const FALLBACK = 'Something went wrong. Please try again.';

/** A message safe to render to a user, whatever was actually thrown. */
export const getErrorMessage = (error: unknown, fallback = FALLBACK): string => {
  if (error instanceof ApiRequestError) {
    // 5xx messages come from the server's own internals; 4xx are written for users.
    return error.status >= 500 ? fallback : error.message;
  }
  // A network failure surfaces as a TypeError from fetch with an unhelpful message.
  if (error instanceof TypeError) return 'Could not reach the server. Check your connection.';
  return fallback;
};

/**
 * Routes field-level errors onto their inputs, and returns whatever is left over
 * for the form-level alert. `null` means every part of the failure was placed on a
 * field and a banner would be repeating it.
 */
export const applyFieldErrors = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  options: { knownFields?: readonly Path<T>[]; fallback?: string } = {},
): string | null => {
  if (!(error instanceof ApiRequestError)) return getErrorMessage(error, options.fallback);

  const entries = Object.entries(error.fieldErrors);
  if (entries.length === 0) return getErrorMessage(error, options.fallback);

  const unplaced: string[] = [];

  for (const [field, message] of entries) {
    const path = field as Path<T>;
    // A field the form does not render cannot show its own error; those are
    // collected into the banner rather than silently dropped.
    if (options.knownFields && !options.knownFields.includes(path)) {
      unplaced.push(message);
      continue;
    }
    setError(path, { type: 'server', message });
  }

  return unplaced.length > 0 ? unplaced.join(' ') : null;
};

/** True when the failure is the API refusing on permission grounds. */
export const isForbidden = (error: unknown): boolean =>
  error instanceof ApiRequestError && error.code === 'FORBIDDEN';
