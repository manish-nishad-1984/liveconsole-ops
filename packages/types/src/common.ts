/**
 * Transport-level contracts. Every REST response the API emits is one of these
 * two shapes, so the web client can narrow on `success` alone.
 */

export type UUID = string;
/** ISO-8601 timestamp. Dates cross the wire as strings, never as `Date`. */
export type ISODateString = string;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    /** Populated for VALIDATION_ERROR so forms can map messages onto fields. */
    details?: ApiFieldError[];
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/* ------------------------------------------------------------------ */
/* Listing                                                             */
/* ------------------------------------------------------------------ */

export type SortDirection = 'asc' | 'desc';

/** Query string accepted by every `GET /:resource` list endpoint. */
export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: SortDirection;
  /** Server-side filters, module specific. Serialised as repeated query params. */
  [key: string]: unknown;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * The list envelope. The API returns `{ success, data: { items, pagination } }` —
 * *not* `{ data: [], meta }`. `api.list()` on the web side depends on this shape.
 */
export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

/* ------------------------------------------------------------------ */
/* Auditing                                                            */
/* ------------------------------------------------------------------ */

export interface AuditFields {
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdById: UUID | null;
  updatedById: UUID | null;
}

export interface UserRef {
  id: UUID;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
}

/** Minimal shape used by pickers and relation columns across modules. */
export interface EntityRef {
  id: UUID;
  code: string | null;
  name: string;
}
