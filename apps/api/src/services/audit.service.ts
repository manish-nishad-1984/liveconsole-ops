import type { AuditAction, Prisma } from '@prisma/client';

import { logger } from '../lib/logger.js';
import { prisma, type Db } from '../lib/prisma.js';
import { getContext } from '../lib/requestContext.js';

/**
 * Audit trail.
 *
 * Every mutating service calls `recordAudit`. Actor, IP, user agent and request id
 * come from ambient request context, so call sites only describe *what* changed.
 * Failures here are logged and swallowed: an audit write must never be the reason
 * a business transaction fails, and the log line makes the gap visible.
 */

export type FieldDiff = Record<string, { from: unknown; to: unknown }>;

export interface RecordAuditInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** Name or document number, captured now so the log survives deletion. */
  entityLabel?: string | null;
  changes?: FieldDiff | null;
  /**
   * Context that is not a field change — a rejection reason, a stage moved back
   * from. Kept apart from `changes` on purpose: a diff answers "what column
   * moved", and forcing a reason into that shape would invent a before-value
   * that never existed.
   */
  metadata?: Record<string, unknown> | null;
  /** Pass the surrounding transaction when the audit row must commit atomically. */
  db?: Db;
}

/** Fields that are never written into an audit diff. */
const SENSITIVE_FIELDS = new Set([
  'passwordHash',
  'password',
  'tokenHash',
  'refreshToken',
  'accessToken',
  'tokenVersion',
]);

const isEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
};

/**
 * Field-level diff between two records. Only keys present in `after` are
 * considered, so partial updates do not read as clearing every other column.
 */
export const diffRecords = (
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
): FieldDiff => {
  const changes: FieldDiff = {};

  for (const [key, next] of Object.entries(after)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    if (key === 'updatedAt' || key === 'updatedById') continue;

    const previous = before?.[key];
    if (!isEqual(previous, next)) {
      changes[key] = { from: previous ?? null, to: next ?? null };
    }
  }

  return changes;
};

/** Split a FieldDiff into the two JSON snapshots the audit table stores. */
const splitDiff = (
  changes: FieldDiff | null | undefined,
): { before: Record<string, unknown> | null; after: Record<string, unknown> | null } => {
  if (!changes || Object.keys(changes).length === 0) return { before: null, after: null };

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [field, change] of Object.entries(changes)) {
    before[field] = change.from ?? null;
    after[field] = change.to ?? null;
  }
  return { before, after };
};

const toJson = (value: Record<string, unknown> | null): Prisma.InputJsonValue | undefined =>
  value ? (value as unknown as Prisma.InputJsonValue) : undefined;

export const recordAudit = async (input: RecordAuditInput): Promise<void> => {
  const context = getContext();
  const client = input.db ?? prisma;
  const { before, after } = splitDiff(input.changes);

  const merged =
    input.metadata && Object.keys(input.metadata).length > 0
      ? { ...(after ?? {}), ...input.metadata }
      : after;

  try {
    await client.auditLog.create({
      data: {
        organizationId: context?.organizationId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        oldValues: toJson(before),
        newValues: toJson(merged),
        changedFields: Object.keys(input.changes ?? {}),
        actorId: context?.actorId ?? null,
        actorEmail: context?.actorEmail ?? null,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        requestId: context?.requestId ?? null,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, entityType: input.entityType, entityId: input.entityId },
      'Failed to write audit log entry',
    );
  }
};

/** Convenience wrapper for the common "record an update if anything changed" case. */
export const recordUpdateAudit = async (
  entityType: string,
  entityId: string,
  entityLabel: string | null,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  db?: Db,
): Promise<void> => {
  const changes = diffRecords(before, after);
  if (Object.keys(changes).length === 0) return;

  await recordAudit({ action: 'UPDATE', entityType, entityId, entityLabel, changes, db });
};
