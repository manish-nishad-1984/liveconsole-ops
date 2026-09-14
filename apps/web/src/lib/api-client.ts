import type {
  ApiError,
  ApiFieldError,
  ApiResponse,
  ErrorCode,
  Paginated,
} from '@liveconsole-ops/types';

import { compact } from './utils';

/**
 * The single HTTP client.
 *
 * Two decisions shape it:
 *  • The access token lives in memory only. Nothing is written to localStorage, so
 *    an XSS payload cannot read a long-lived credential; the refresh token is an
 *    httpOnly cookie the JavaScript never sees.
 *  • A 401 triggers exactly one refresh attempt, and concurrent requests wait on
 *    that same promise rather than each firing their own — otherwise a page with
 *    six queries would race six refreshes and invalidate its own token family.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

/* ------------------------------------------------------------------ */
/* Error type                                                          */
/* ------------------------------------------------------------------ */

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ApiFieldError[];

  constructor(status: number, code: ErrorCode, message: string, details?: ApiFieldError[]) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Map field errors onto react-hook-form's `setError` shape. */
  get fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const detail of this.details ?? []) errors[detail.field] = detail.message;
    return errors;
  }

  get isAuthError(): boolean {
    return this.code === 'UNAUTHENTICATED' || this.code === 'TOKEN_EXPIRED';
  }
}

/* ------------------------------------------------------------------ */
/* Token + session plumbing                                            */
/* ------------------------------------------------------------------ */

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

/** The auth store registers a callback so an unrecoverable 401 signs the user out. */
export const setSessionExpiredHandler = (handler: (() => void) | null): void => {
  onSessionExpired = handler;
};

/** Refresh the access token, collapsing concurrent callers onto one request. */
const refreshAccessToken = async (): Promise<string | null> => {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as ApiResponse<{
        tokens: { accessToken: string };
      }>;
      if (!payload.success) return null;

      accessToken = payload.data.tokens.accessToken;
      return accessToken;
    } catch {
      return null;
    } finally {
      // Release the lock on the next tick so callers awaiting it see the result.
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
};

/* ------------------------------------------------------------------ */
/* Request pipeline                                                    */
/* ------------------------------------------------------------------ */

export type QueryParams = Record<
  string,
  string | number | boolean | (string | number)[] | null | undefined
>;

const buildUrl = (path: string, params?: QueryParams): string => {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(compact(params))) {
    if (Array.isArray(value)) {
      // Repeated keys, matching the `arrayOf` coercion on the API side.
      for (const entry of value) search.append(key, String(entry));
    } else {
      search.append(key, String(value));
    }
  }

  const queryString = search.toString();
  return queryString ? `${url}?${queryString}` : url;
};

interface RequestOptions {
  params?: QueryParams;
  signal?: AbortSignal;
  /** Internal: prevents an infinite refresh loop. */
  _isRetry?: boolean;
}

const parseError = async (response: Response): Promise<ApiRequestError> => {
  let code: ErrorCode = 'INTERNAL_ERROR';
  let message = response.statusText || 'Request failed';
  let details: ApiFieldError[] | undefined;

  try {
    const payload = (await response.json()) as ApiError;
    if (payload?.error) {
      code = payload.error.code;
      message = payload.error.message;
      details = payload.error.details;
    }
  } catch {
    // Non-JSON error body (proxy timeout, HTML error page) — keep the status text.
  }

  return new ApiRequestError(response.status, code, message, details);
};

const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(buildUrl(path, options.params), {
    method,
    headers,
    credentials: 'include',
    signal: options.signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && !options._isRetry && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(method, path, body, { ...options, _isRetry: true });
    }
    onSessionExpired?.();
    throw new ApiRequestError(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in.');
  }

  if (!response.ok) throw await parseError(response);

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) {
    throw new ApiRequestError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.details,
    );
  }

  return payload.data;
};

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<T>('GET', path, undefined, { params, signal }),

  /** Convenience for the paginated list shape every module returns. */
  list: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<Paginated<T>>('GET', path, undefined, { params, signal }),

  post: <T>(path: string, body?: unknown, params?: QueryParams) =>
    request<T>('POST', path, body, { params }),

  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),

  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),

  delete: <T = void>(path: string) => request<T>('DELETE', path, undefined),

  /**
   * Binary/text download (CSV export). Returns the blob plus the filename the
   * server suggested, so the caller does not have to guess it.
   */
  download: async (
    path: string,
    params?: QueryParams,
  ): Promise<{ blob: Blob; fileName: string | null }> => {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response = await fetch(buildUrl(path, params), { headers, credentials: 'include' });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        onSessionExpired?.();
        throw new ApiRequestError(401, 'UNAUTHENTICATED', 'Your session has ended.');
      }
      response = await fetch(buildUrl(path, params), {
        headers: { Authorization: `Bearer ${refreshed}` },
        credentials: 'include',
      });
    }

    if (!response.ok) throw await parseError(response);

    const disposition = response.headers.get('Content-Disposition');
    const match = disposition ? /filename="?([^";]+)"?/.exec(disposition) : null;

    return { blob: await response.blob(), fileName: match?.[1] ?? null };
  },
};
