import type {
  AttachmentDto,
  BulkApproveResponse,
  ExpenseDto,
  ExpenseListDto,
  StatusTotal,
} from '@liveconsole-ops/types';
import type { ExpenseStatus } from '@prisma/client';
import type { Readable } from 'node:stream';

import { toCsv } from '../../lib/csv.js';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { formatDateOnly, money, parseDateOnly, todayInIndia } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { buildPaginationMeta } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import {
  actorCan,
  auditCreate,
  auditUpdate,
  getActorId,
  requireOrg,
} from '../../lib/requestContext.js';
import { deleteFile, fileExists, openFile, saveFile } from '../../lib/storage.js';
import { diffRecords, recordAudit } from '../../services/audit.service.js';
import { employeeScope, findActiveEmployee } from '../../services/ledger.service.js';
import * as repository from './expenses.repository.js';
import type { AttachmentRecord, ExpenseRecord } from './expenses.repository.js';
import type {
  ApproveInput,
  BulkApproveInput,
  ExpenseInput,
  ExpenseListQueryInput,
  RejectInput,
  UpdateExpenseInput,
} from './expenses.schema.js';

/**
 * Expenses — what employees spend at site, submitted for an administrator to
 * approve. Only APPROVED expenses reduce an employee's balance.
 *
 * Who can do what:
 *  • Everyone sees their own expenses. `expenses:manage` or `expenses:approve`
 *    sees everyone's (an approver has to see what they are approving).
 *  • The owner may edit or delete while PENDING or REJECTED. Editing a REJECTED
 *    expense resubmits it as PENDING.
 *  • `expenses:manage` may edit or delete anyone's expense that is not APPROVED.
 *  • An APPROVED expense is locked. To correct one, an approver reopens it first,
 *    which puts it back to PENDING and takes it out of the balance.
 */

const DOCUMENT_PREFIX = 'EX';
const MAX_ATTACHMENTS = 5;

const scope = () => employeeScope('expenses:manage', 'expenses:approve');

const isEditable = (
  expense: { status: ExpenseStatus; employeeId: string },
  action: 'update' | 'delete',
) => {
  if (expense.status === 'APPROVED') return false;
  if (!actorCan(`expenses:${action}`)) return false;
  return actorCan('expenses:manage') || expense.employeeId === getActorId();
};

const toDto = (expense: ExpenseRecord, attachmentCount = 0): ExpenseDto => ({
  id: expense.id,
  expenseNo: expense.expenseNo,
  employee: expense.employee,
  site: expense.site,
  category: expense.category,
  expenseDate: formatDateOnly(expense.expenseDate),
  amount: money(expense.amount),
  paymentMode: expense.paymentMode,
  paidTo: expense.paidTo,
  description: expense.description,
  status: expense.status,
  reviewedBy: expense.reviewedBy,
  reviewedAt: expense.reviewedAt?.toISOString() ?? null,
  reviewNote: expense.reviewNote,
  attachmentCount,
  canEdit: isEditable(expense, 'update'),
  createdAt: expense.createdAt.toISOString(),
  updatedAt: expense.updatedAt.toISOString(),
  createdById: expense.createdById,
  updatedById: expense.updatedById,
});

const toAttachmentDto = (attachment: AttachmentRecord): AttachmentDto => ({
  id: attachment.id,
  fileName: attachment.fileName,
  mimeType: attachment.mimeType,
  sizeBytes: attachment.sizeBytes,
  uploadedBy: attachment.uploadedBy,
  createdAt: attachment.createdAt.toISOString(),
});

/** Maps a list of records to DTOs with their attachment counts in one query. */
export const toDtos = async (organizationId: string, expenses: ExpenseRecord[]) => {
  const counts = await repository.countAttachmentsByExpense(
    organizationId,
    expenses.map((expense) => expense.id),
  );
  return expenses.map((expense) => toDto(expense, counts.get(expense.id) ?? 0));
};

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export const list = async (query: ExpenseListQueryInput): Promise<ExpenseListDto> => {
  const organizationId = requireOrg();
  const { items, total, page, pageSize, byStatus } = await repository.listExpenses(
    organizationId,
    query,
    scope(),
  );

  const statusTotal = (status: ExpenseStatus): StatusTotal => {
    const row = byStatus.find((entry) => entry.status === status);
    return { count: row?._count._all ?? 0, amount: money(row?._sum.amount) };
  };

  return {
    items: await toDtos(organizationId, items),
    pagination: buildPaginationMeta(total, { page, pageSize }),
    summary: {
      pending: statusTotal('PENDING'),
      approved: statusTotal('APPROVED'),
      rejected: statusTotal('REJECTED'),
    },
  };
};

const loadVisible = async (organizationId: string, id: string) => {
  const expense = await repository.findExpenseById(organizationId, id, scope());
  if (!expense) throw new NotFoundError('Expense');
  return expense;
};

export const getById = async (id: string): Promise<ExpenseDto> => {
  const organizationId = requireOrg();
  const expense = await loadVisible(organizationId, id);
  const attachments = await repository.listAttachments(organizationId, id);
  return {
    ...toDto(expense, attachments.length),
    attachments: attachments.map(toAttachmentDto),
  };
};

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

const assertNotFuture = (date: string) => {
  if (date > todayInIndia())
    throw new BusinessRuleError('The expense date cannot be in the future');
};

const assertReferences = async (
  organizationId: string,
  refs: { employeeId?: string; siteId?: string; categoryId?: string },
) => {
  if (refs.employeeId && !(await findActiveEmployee(organizationId, refs.employeeId))) {
    throw new BusinessRuleError('The selected employee is not an active user');
  }
  if (refs.siteId && !(await repository.findActiveSite(organizationId, refs.siteId))) {
    throw new BusinessRuleError('The selected site is not active');
  }
  if (refs.categoryId && !(await repository.findActiveCategory(organizationId, refs.categoryId))) {
    throw new BusinessRuleError('The selected category is not active');
  }
};

export const create = async (input: ExpenseInput): Promise<ExpenseDto> => {
  const organizationId = requireOrg();
  const actorId = getActorId()!;

  const employeeId = input.employeeId && actorCan('expenses:manage') ? input.employeeId : actorId;

  assertNotFuture(input.expenseDate);
  await assertReferences(organizationId, {
    employeeId: employeeId === actorId ? undefined : employeeId,
    siteId: input.siteId,
    categoryId: input.categoryId,
  });

  const expenseDate = parseDateOnly(input.expenseDate);

  const expense = await prisma.$transaction(async (tx) => {
    const expenseNo = await nextDocumentNumber(tx, organizationId, DOCUMENT_PREFIX, expenseDate);

    const createdExpense = await repository.createExpense(
      {
        organizationId,
        expenseNo,
        employeeId,
        siteId: input.siteId,
        categoryId: input.categoryId,
        expenseDate,
        amount: input.amount,
        paymentMode: input.paymentMode,
        paidTo: input.paidTo ?? null,
        description: input.description,
        ...auditCreate(),
      },
      tx,
    );

    await recordAudit({
      action: 'CREATE',
      entityType: 'Expense',
      entityId: createdExpense.id,
      entityLabel: expenseNo,
      changes: diffRecords(null, {
        employee: createdExpense.employee.fullName,
        site: createdExpense.site.name,
        amount: money(createdExpense.amount),
      }),
      db: tx,
    });

    return createdExpense;
  });

  return toDto(expense);
};

export const update = async (id: string, input: UpdateExpenseInput): Promise<ExpenseDto> => {
  const organizationId = requireOrg();
  const existing = await loadVisible(organizationId, id);

  if (existing.status === 'APPROVED') {
    throw new BusinessRuleError(
      'An approved expense cannot be changed. Ask an approver to reopen it.',
    );
  }
  if (!isEditable(existing, 'update')) {
    throw new ForbiddenError('You can only edit your own expenses');
  }
  if (
    input.employeeId &&
    input.employeeId !== existing.employeeId &&
    !actorCan('expenses:manage')
  ) {
    throw new ForbiddenError('You cannot move an expense to another employee');
  }

  if (input.expenseDate) assertNotFuture(input.expenseDate);
  await assertReferences(organizationId, {
    employeeId: input.employeeId !== existing.employeeId ? input.employeeId : undefined,
    siteId: input.siteId !== existing.siteId ? input.siteId : undefined,
    categoryId: input.categoryId !== existing.categoryId ? input.categoryId : undefined,
  });

  // Fixing a rejected expense is a resubmission.
  const resubmit = existing.status === 'REJECTED';

  const expense = await repository.updateExpense(id, {
    ...(input.employeeId !== undefined ? { employeeId: input.employeeId } : {}),
    ...(input.siteId !== undefined ? { siteId: input.siteId } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.expenseDate !== undefined ? { expenseDate: parseDateOnly(input.expenseDate) } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.paymentMode !== undefined ? { paymentMode: input.paymentMode } : {}),
    ...(input.paidTo !== undefined ? { paidTo: input.paidTo } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(resubmit
      ? {
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
          reviewNote: null,
        }
      : {}),
    ...auditUpdate(),
  });

  const snapshot = (record: ExpenseRecord) => ({
    ...toDto(record),
    employee: record.employee.fullName,
    site: record.site.name,
    category: record.category.name,
    reviewedBy: record.reviewedBy?.fullName ?? null,
  });

  await recordAudit({
    action: 'UPDATE',
    entityType: 'Expense',
    entityId: id,
    entityLabel: expense.expenseNo,
    changes: diffRecords(snapshot(existing), snapshot(expense)),
    metadata: resubmit ? { resubmitted: true } : null,
  });

  const attachments = await repository.countAttachmentsByExpense(organizationId, [id]);
  return toDto(expense, attachments.get(id) ?? 0);
};

export const remove = async (id: string): Promise<ExpenseDto> => {
  const organizationId = requireOrg();
  const existing = await loadVisible(organizationId, id);

  if (existing.status === 'APPROVED') {
    throw new BusinessRuleError(
      'An approved expense cannot be deleted. Ask an approver to reopen it.',
    );
  }
  if (!isEditable(existing, 'delete')) {
    throw new ForbiddenError('You can only delete your own expenses');
  }

  const expense = await repository.updateExpense(id, {
    isActive: false,
    deletedAt: new Date(),
    ...auditUpdate(),
  });

  await recordAudit({
    action: 'DELETE',
    entityType: 'Expense',
    entityId: id,
    entityLabel: expense.expenseNo,
    changes: { amount: { from: money(existing.amount), to: null } },
  });

  return toDto(expense);
};

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

const review = async (
  id: string,
  from: ExpenseStatus[],
  to: ExpenseStatus,
  note: string | null,
): Promise<ExpenseDto> => {
  const organizationId = requireOrg();
  const actorId = getActorId()!;

  const expense = await prisma.$transaction(async (tx) => {
    const existing = await repository.findExpenseById(organizationId, id, null, tx);
    if (!existing) throw new NotFoundError('Expense');
    if (!from.includes(existing.status)) {
      throw new BusinessRuleError(
        `This expense is already ${existing.status.toLowerCase()} and cannot be moved to ${to.toLowerCase()}`,
      );
    }

    const reviewed = to !== 'PENDING';
    const updated = await repository.updateExpense(
      id,
      {
        status: to,
        reviewedById: reviewed ? actorId : null,
        reviewedAt: reviewed ? new Date() : null,
        reviewNote: reviewed ? note : null,
        ...auditUpdate(),
      },
      tx,
    );

    await recordAudit({
      action: to === 'APPROVED' ? 'APPROVE' : to === 'REJECTED' ? 'REJECT' : 'STATUS_CHANGE',
      entityType: 'Expense',
      entityId: id,
      entityLabel: updated.expenseNo,
      changes: { status: { from: existing.status, to } },
      metadata: note ? { note } : null,
      db: tx,
    });

    return updated;
  });

  const attachments = await repository.countAttachmentsByExpense(organizationId, [id]);
  return toDto(expense, attachments.get(id) ?? 0);
};

export const approve = (id: string, input: ApproveInput) =>
  review(id, ['PENDING'], 'APPROVED', input.note ?? null);

export const reject = (id: string, input: RejectInput) =>
  review(id, ['PENDING'], 'REJECTED', input.note);

/** Back to PENDING — the only way to correct an approved expense. */
export const reopen = (id: string) => review(id, ['APPROVED', 'REJECTED'], 'PENDING', null);

export const bulkApprove = async (input: BulkApproveInput): Promise<BulkApproveResponse> => {
  const organizationId = requireOrg();
  const actorId = getActorId()!;
  const ids = [...new Set(input.ids)];

  const pending = await repository.findPendingByIds(organizationId, ids);
  if (pending.length === 0) return { approved: 0, skipped: ids.length };

  const { count } = await repository.approveMany(
    pending.map((expense) => expense.id),
    {
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: input.note ?? null,
      updatedById: actorId,
    },
  );

  for (const expense of pending) {
    await recordAudit({
      action: 'APPROVE',
      entityType: 'Expense',
      entityId: expense.id,
      entityLabel: expense.expenseNo,
      changes: { status: { from: 'PENDING', to: 'APPROVED' } },
      metadata: { bulk: true, ...(input.note ? { note: input.note } : {}) },
    });
  }

  return { approved: count, skipped: ids.length - count };
};

/* ------------------------------------------------------------------ */
/* Attachments                                                         */
/* ------------------------------------------------------------------ */

/** Attaching is part of editing — plus administrators may add a bill to any expense. */
const assertCanAttach = (expense: ExpenseRecord) => {
  if (actorCan('expenses:manage')) return;
  if (!isEditable(expense, 'update')) {
    throw new BusinessRuleError(
      expense.status === 'APPROVED'
        ? 'Receipts cannot be changed on an approved expense'
        : 'You can only add receipts to your own expenses',
    );
  }
};

export const addAttachment = async (
  id: string,
  file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  },
): Promise<AttachmentDto> => {
  const organizationId = requireOrg();
  const expense = await loadVisible(organizationId, id);
  assertCanAttach(expense);

  const existing = await repository.countAttachmentsByExpense(organizationId, [id]);
  if ((existing.get(id) ?? 0) >= MAX_ATTACHMENTS) {
    throw new BusinessRuleError(`An expense can have at most ${MAX_ATTACHMENTS} receipts`);
  }

  const storedName = await saveFile(file.buffer, file.mimetype);

  try {
    const attachment = await repository.createAttachment({
      organizationId,
      entityType: repository.ATTACHMENT_ENTITY,
      entityId: id,
      fileName: file.originalname.slice(0, 200) || 'receipt',
      storedName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedById: getActorId()!,
    });

    await recordAudit({
      action: 'UPDATE',
      entityType: 'Expense',
      entityId: id,
      entityLabel: expense.expenseNo,
      metadata: { attachmentAdded: attachment.fileName },
    });

    return toAttachmentDto(attachment);
  } catch (error) {
    // No row means nothing will ever reference the file — do not leave it behind.
    await deleteFile(storedName).catch(() => {});
    throw error;
  }
};

export const openAttachment = async (
  id: string,
  attachmentId: string,
): Promise<{ attachment: AttachmentRecord; stream: Readable }> => {
  const organizationId = requireOrg();
  await loadVisible(organizationId, id);

  const attachment = await repository.findAttachment(organizationId, id, attachmentId);
  if (!attachment || !(await fileExists(attachment.storedName))) {
    throw new NotFoundError('Receipt');
  }

  return { attachment, stream: openFile(attachment.storedName) };
};

export const removeAttachment = async (id: string, attachmentId: string): Promise<void> => {
  const organizationId = requireOrg();
  const expense = await loadVisible(organizationId, id);
  assertCanAttach(expense);

  const attachment = await repository.findAttachment(organizationId, id, attachmentId);
  if (!attachment) throw new NotFoundError('Receipt');

  await repository.deleteAttachment(attachment.id);
  await deleteFile(attachment.storedName).catch((error: unknown) => {
    logger.warn({ err: error, storedName: attachment.storedName }, 'Could not delete receipt file');
  });

  await recordAudit({
    action: 'UPDATE',
    entityType: 'Expense',
    entityId: id,
    entityLabel: expense.expenseNo,
    metadata: { attachmentRemoved: attachment.fileName },
  });
};

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export const exportToCsv = async (query: ExpenseListQueryInput): Promise<string> => {
  const expenses = await repository.listAllExpenses(requireOrg(), query, scope());

  await recordAudit({
    action: 'EXPORT',
    entityType: 'Expense',
    entityLabel: `${expenses.length} rows`,
  });

  return toCsv(
    [
      'Expense No',
      'Date',
      'Employee',
      'Site',
      'Category',
      'Description',
      'Paid To',
      'Mode',
      'Amount',
      'Status',
      'Reviewed By',
      'Review Note',
    ],
    expenses.map((expense) => [
      expense.expenseNo,
      formatDateOnly(expense.expenseDate),
      expense.employee.fullName,
      expense.site.name,
      expense.category.name,
      expense.description,
      expense.paidTo,
      expense.paymentMode,
      money(expense.amount),
      expense.status,
      expense.reviewedBy?.fullName,
      expense.reviewNote,
    ]),
  );
};
