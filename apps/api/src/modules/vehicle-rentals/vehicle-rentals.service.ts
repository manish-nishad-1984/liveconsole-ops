import type {
  RentPaymentDto,
  RentPaymentStatus,
  RentalStatus,
  VehicleRentalDto,
  VehicleRentalListDto,
  VehicleRentalSuggestionsDto,
} from '@liveconsole-ops/types';
import type { Prisma } from '@prisma/client';

import { toCsv } from '../../lib/csv.js';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import {
  ZERO,
  formatDateOnly,
  money,
  parseDateOnly,
  todayInIndia,
  toDecimal,
} from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { buildPaginationMeta, resolvePagination } from '../../lib/pagination.js';
import { prisma, type Db } from '../../lib/prisma.js';
import {
  actorCan,
  auditCreate,
  auditUpdate,
  getActorId,
  requireOrg,
} from '../../lib/requestContext.js';
import { diffRecords, recordAudit } from '../../services/audit.service.js';
import { employeeScope, findActiveEmployee } from '../../services/ledger.service.js';
import * as repository from './vehicle-rentals.repository.js';
import type { PaymentRecord, RentalRecord } from './vehicle-rentals.repository.js';
import type {
  PaymentInput,
  RentalInput,
  RentalListQueryInput,
  UpdatePaymentInput,
  UpdateRentalInput,
} from './vehicle-rentals.schema.js';

/**
 * Vehicle rentals — vehicles hired for a site, and the rent paid for them.
 *
 *   rent due = (PER_DAY: rate × days on rent · FIXED: rate) + extra charges
 *
 * Days on rent run from `fromDate` to `toDate`, or to today while the vehicle is
 * still out. Payment and rental statuses are derived, never stored, so they
 * cannot drift from the numbers behind them.
 *
 * Who can do what:
 *  • The employee in charge sees and edits their rentals; `transport:manage`
 *    sees and edits everyone's.
 *  • A payment from PETTY_CASH creates an Expense for whoever paid, in the
 *    "Vehicle Rent" category. It then needs approval like any other expense and
 *    only moves their balance once approved. A rejected one no longer counts as
 *    paid. Once its expense is approved the payment is locked.
 *  • Paying more than is due is refused once the amount due is final (a closed
 *    per-day rental, or a fixed rent). While a per-day rental is still running an
 *    advance is allowed.
 */

const DOCUMENT_PREFIX = 'VR';
const EXPENSE_PREFIX = 'EX';

const scope = () => employeeScope('transport:manage');

/* ------------------------------------------------------------------ */
/* Calculation                                                         */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

interface RentFigures {
  days: number;
  rentDue: Prisma.Decimal;
  paid: Prisma.Decimal;
  pending: Prisma.Decimal;
  paymentStatus: RentPaymentStatus;
  rentalStatus: RentalStatus;
  /** True when no further days can be added — the amount due will not grow. */
  dueIsFinal: boolean;
}

/** A payment counts as paid unless its petty cash expense was rejected. */
const isCounted = (payment: Pick<PaymentRecord, 'expense'>) =>
  !payment.expense || payment.expense.status !== 'REJECTED';

type RentTerms = Pick<RentalRecord, 'fromDate' | 'toDate' | 'rentBasis' | 'rate' | 'extraCharges'>;

const computeFigures = (
  rental: RentTerms,
  payments: Pick<PaymentRecord, 'id' | 'amount' | 'expense'>[],
  options: { excludePaymentId?: string } = {},
): RentFigures => {
  const today = todayInIndia();
  const from = formatDateOnly(rental.fromDate);
  const to = rental.toDate ? formatDateOnly(rental.toDate) : null;

  const end = to ?? today;
  const days =
    end < from
      ? 0
      : Math.round((parseDateOnly(end).getTime() - parseDateOnly(from).getTime()) / DAY_MS) + 1;

  const base =
    rental.rentBasis === 'PER_DAY' ? toDecimal(rental.rate).times(days) : toDecimal(rental.rate);
  const rentDue = base.plus(toDecimal(rental.extraCharges));

  const paid = payments
    .filter((payment) => payment.id !== options.excludePaymentId && isCounted(payment))
    .reduce((total, payment) => total.plus(toDecimal(payment.amount)), ZERO);

  const paymentStatus: RentPaymentStatus = paid.lessThanOrEqualTo(0)
    ? 'PENDING'
    : paid.greaterThanOrEqualTo(rentDue)
      ? 'PAID'
      : 'PARTIAL';

  const rentalStatus: RentalStatus =
    today < from ? 'UPCOMING' : to && to < today ? 'COMPLETED' : 'ON_RENT';

  return {
    days,
    rentDue,
    paid,
    pending: rentDue.minus(paid),
    paymentStatus,
    rentalStatus,
    dueIsFinal: rental.rentBasis === 'FIXED' || to !== null,
  };
};

/* ------------------------------------------------------------------ */
/* Access                                                              */
/* ------------------------------------------------------------------ */

const canActOn = (rental: { employeeId: string }, action: 'update' | 'delete') =>
  actorCan(`transport:${action}`) &&
  (actorCan('transport:manage') || rental.employeeId === getActorId());

/** An approved petty cash expense locks its payment, as it locks the expense. */
const isPaymentLocked = (payment: Pick<PaymentRecord, 'expense'>) =>
  payment.expense?.status === 'APPROVED';

/* ------------------------------------------------------------------ */
/* DTOs                                                                */
/* ------------------------------------------------------------------ */

const toPaymentDto = (payment: PaymentRecord, rental: { employeeId: string }): RentPaymentDto => ({
  id: payment.id,
  paymentDate: formatDateOnly(payment.paymentDate),
  amount: money(payment.amount),
  paymentMode: payment.paymentMode,
  source: payment.source,
  paidBy: payment.paidBy,
  referenceNo: payment.referenceNo,
  notes: payment.notes,
  expense:
    payment.expense && !payment.expense.deletedAt
      ? {
          id: payment.expense.id,
          expenseNo: payment.expense.expenseNo,
          status: payment.expense.status,
        }
      : null,
  counted: isCounted(payment),
  canEdit: !isPaymentLocked(payment) && canActOn(rental, 'update'),
  createdAt: payment.createdAt.toISOString(),
  updatedAt: payment.updatedAt.toISOString(),
  createdById: payment.createdById,
  updatedById: payment.updatedById,
});

const toDto = (rental: RentalRecord, withPayments = false): VehicleRentalDto => {
  const figures = computeFigures(rental, rental.payments);
  return {
    id: rental.id,
    rentalNo: rental.rentalNo,
    employee: rental.employee,
    site: rental.site,
    vehicleType: rental.vehicleType,
    vehicleNumber: rental.vehicleNumber,
    vendorName: rental.vendorName,
    vendorMobile: rental.vendorMobile,
    driverName: rental.driverName,
    driverMobile: rental.driverMobile,
    fromDate: formatDateOnly(rental.fromDate),
    toDate: rental.toDate ? formatDateOnly(rental.toDate) : null,
    rentBasis: rental.rentBasis,
    rate: money(rental.rate),
    extraCharges: money(rental.extraCharges),
    notes: rental.notes,
    days: figures.days,
    rentDue: money(figures.rentDue),
    paidAmount: money(figures.paid),
    pendingAmount: money(figures.pending),
    paymentStatus: figures.paymentStatus,
    rentalStatus: figures.rentalStatus,
    paymentCount: rental.payments.length,
    canEdit: canActOn(rental, 'update'),
    ...(withPayments
      ? { payments: rental.payments.map((payment) => toPaymentDto(payment, rental)) }
      : {}),
    createdAt: rental.createdAt.toISOString(),
    updatedAt: rental.updatedAt.toISOString(),
    createdById: rental.createdById,
    updatedById: rental.updatedById,
  };
};

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** Every rental matching the filters, as DTOs, with the computed status filters applied. */
const filteredRentals = async (query: RentalListQueryInput): Promise<VehicleRentalDto[]> => {
  const records = await repository.listRentals(requireOrg(), query, scope());
  let rentals = records
    .map((record) => toDto(record))
    .filter(
      (rental) =>
        (!query.paymentStatus || rental.paymentStatus === query.paymentStatus) &&
        (!query.rentalStatus || rental.rentalStatus === query.rentalStatus),
    );

  if (query.sortBy === 'pendingAmount') {
    const direction = query.sortDir === 'asc' ? 1 : -1;
    rentals = [...rentals].sort(
      (a, b) => toDecimal(a.pendingAmount).comparedTo(toDecimal(b.pendingAmount)) * direction,
    );
  }
  return rentals;
};

export const list = async (query: RentalListQueryInput): Promise<VehicleRentalListDto> => {
  const rentals = await filteredRentals(query);
  const { skip, take, page, pageSize } = resolvePagination(query);

  let rentDue = ZERO;
  let paid = ZERO;
  let pending = ZERO;
  let onRent = 0;
  for (const rental of rentals) {
    rentDue = rentDue.plus(toDecimal(rental.rentDue));
    paid = paid.plus(toDecimal(rental.paidAmount));
    // An advance on one rental does not reduce what is owed on another.
    const owed = toDecimal(rental.pendingAmount);
    if (owed.greaterThan(0)) pending = pending.plus(owed);
    if (rental.rentalStatus === 'ON_RENT') onRent += 1;
  }

  return {
    items: rentals.slice(skip, skip + take),
    pagination: buildPaginationMeta(rentals.length, { page, pageSize }),
    summary: {
      count: rentals.length,
      onRent,
      rentDue: money(rentDue),
      paid: money(paid),
      pending: money(pending),
    },
  };
};

/** The two figures the dashboard shows, for whoever is asking. */
export const dashboardSummary = async (): Promise<{ onRent: number; pending: string }> => {
  const { summary } = await list({ page: 1, pageSize: 1 });
  return { onRent: summary.onRent, pending: summary.pending };
};

const loadVisible = async (organizationId: string, id: string, db: Db = prisma) => {
  const rental = await repository.findRentalById(organizationId, id, scope(), db);
  if (!rental) throw new NotFoundError('Vehicle rental');
  return rental;
};

export const getById = async (id: string): Promise<VehicleRentalDto> =>
  toDto(await loadVisible(requireOrg(), id), true);

export const suggestions = async (): Promise<VehicleRentalSuggestionsDto> => {
  const { types, vendors } = await repository.listSuggestions(requireOrg());
  const seen = new Set<string>();
  return {
    vehicleTypes: types.map((row) => row.vehicleType),
    vendors: vendors
      .filter((row) => {
        const key = row.vendorName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((row) => ({ name: row.vendorName, mobile: row.vendorMobile })),
  };
};

/* ------------------------------------------------------------------ */
/* Rental writes                                                       */
/* ------------------------------------------------------------------ */

const assertReferences = async (
  organizationId: string,
  refs: { employeeId?: string | null; siteId?: string | null },
) => {
  if (refs.employeeId && !(await findActiveEmployee(organizationId, refs.employeeId))) {
    throw new BusinessRuleError('The selected employee is not an active user');
  }
  if (refs.siteId && !(await repository.findActiveSite(organizationId, refs.siteId))) {
    throw new BusinessRuleError('The selected site is not active');
  }
};

/** Audit snapshot — names rather than ids, so the trail reads on its own. */
const snapshot = (rental: RentalRecord) => ({
  employee: rental.employee.fullName,
  site: rental.site?.name ?? null,
  vehicleType: rental.vehicleType,
  vehicleNumber: rental.vehicleNumber,
  vendorName: rental.vendorName,
  vendorMobile: rental.vendorMobile,
  driverName: rental.driverName,
  driverMobile: rental.driverMobile,
  fromDate: formatDateOnly(rental.fromDate),
  toDate: rental.toDate ? formatDateOnly(rental.toDate) : null,
  rentBasis: rental.rentBasis,
  rate: money(rental.rate),
  extraCharges: money(rental.extraCharges),
  notes: rental.notes,
});

export const create = async (input: RentalInput): Promise<VehicleRentalDto> => {
  const organizationId = requireOrg();
  const actorId = getActorId()!;
  const employeeId = input.employeeId && actorCan('transport:manage') ? input.employeeId : actorId;

  await assertReferences(organizationId, {
    employeeId: employeeId === actorId ? undefined : employeeId,
    siteId: input.siteId,
  });

  const fromDate = parseDateOnly(input.fromDate);

  const rental = await prisma.$transaction(async (tx) => {
    const rentalNo = await nextDocumentNumber(tx, organizationId, DOCUMENT_PREFIX, fromDate);

    const created = await repository.createRental(
      {
        organizationId,
        rentalNo,
        employeeId,
        siteId: input.siteId ?? null,
        vehicleType: input.vehicleType,
        vehicleNumber: input.vehicleNumber?.toUpperCase() ?? null,
        vendorName: input.vendorName,
        vendorMobile: input.vendorMobile ?? null,
        driverName: input.driverName ?? null,
        driverMobile: input.driverMobile ?? null,
        fromDate,
        toDate: input.toDate ? parseDateOnly(input.toDate) : null,
        rentBasis: input.rentBasis,
        rate: input.rate,
        extraCharges: input.extraCharges ?? '0',
        notes: input.notes ?? null,
        ...auditCreate(),
      },
      tx,
    );

    await recordAudit({
      action: 'CREATE',
      entityType: 'VehicleRental',
      entityId: created.id,
      entityLabel: rentalNo,
      changes: diffRecords(null, snapshot(created)),
      db: tx,
    });

    return created;
  });

  return toDto(rental, true);
};

export const update = async (id: string, input: UpdateRentalInput): Promise<VehicleRentalDto> => {
  const organizationId = requireOrg();
  const existing = await loadVisible(organizationId, id);

  if (!canActOn(existing, 'update')) {
    throw new ForbiddenError('You can only edit vehicle rentals you are in charge of');
  }
  if (
    input.employeeId &&
    input.employeeId !== existing.employeeId &&
    !actorCan('transport:manage')
  ) {
    throw new ForbiddenError('You cannot hand a rental to another employee');
  }

  // A partial update must still leave a valid period.
  const fromDate = input.fromDate ?? formatDateOnly(existing.fromDate);
  const toDate =
    input.toDate !== undefined
      ? input.toDate
      : existing.toDate
        ? formatDateOnly(existing.toDate)
        : null;
  if (toDate && toDate < fromDate) {
    throw new BusinessRuleError('The end date cannot be before the start date');
  }

  await assertReferences(organizationId, {
    employeeId: input.employeeId !== existing.employeeId ? input.employeeId : undefined,
    siteId: input.siteId !== existing.siteId ? input.siteId : undefined,
  });

  const rental = await repository.updateRental(id, {
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.siteId !== undefined ? { siteId: input.siteId } : {}),
    ...(input.vehicleType !== undefined ? { vehicleType: input.vehicleType } : {}),
    ...(input.vehicleNumber !== undefined
      ? { vehicleNumber: input.vehicleNumber?.toUpperCase() ?? null }
      : {}),
    ...(input.vendorName !== undefined ? { vendorName: input.vendorName } : {}),
    ...(input.vendorMobile !== undefined ? { vendorMobile: input.vendorMobile } : {}),
    ...(input.driverName !== undefined ? { driverName: input.driverName } : {}),
    ...(input.driverMobile !== undefined ? { driverMobile: input.driverMobile } : {}),
    ...(input.fromDate !== undefined ? { fromDate: parseDateOnly(input.fromDate) } : {}),
    ...(input.toDate !== undefined
      ? { toDate: input.toDate ? parseDateOnly(input.toDate) : null }
      : {}),
    ...(input.rentBasis !== undefined ? { rentBasis: input.rentBasis } : {}),
    ...(input.rate !== undefined ? { rate: input.rate } : {}),
    ...(input.extraCharges !== undefined ? { extraCharges: input.extraCharges ?? '0' } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...auditUpdate(),
  });

  await recordAudit({
    action: 'UPDATE',
    entityType: 'VehicleRental',
    entityId: id,
    entityLabel: rental.rentalNo,
    changes: diffRecords(snapshot(existing), snapshot(rental)),
  });

  return toDto(rental, true);
};

export const remove = async (id: string): Promise<VehicleRentalDto> => {
  const organizationId = requireOrg();
  const existing = await loadVisible(organizationId, id);

  if (!canActOn(existing, 'delete')) {
    throw new ForbiddenError('You can only delete vehicle rentals you are in charge of');
  }
  if (existing.payments.length > 0) {
    throw new BusinessRuleError(
      'This rental has payments recorded. Delete the payments first, then the rental.',
    );
  }

  const rental = await repository.updateRental(id, {
    isActive: false,
    deletedAt: new Date(),
    ...auditUpdate(),
  });

  await recordAudit({
    action: 'DELETE',
    entityType: 'VehicleRental',
    entityId: id,
    entityLabel: rental.rentalNo,
    changes: { vehicle: { from: existing.vehicleType, to: null } },
  });

  return toDto(rental);
};

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

const assertNotFuture = (date: string) => {
  if (date > todayInIndia())
    throw new BusinessRuleError('The payment date cannot be in the future');
};

const assertWithinDue = (rental: RentalRecord, amount: string, excludePaymentId?: string) => {
  const figures = computeFigures(rental, rental.payments, { excludePaymentId });
  if (!figures.dueIsFinal) return;

  const remaining = figures.pending.isNegative() ? ZERO : figures.pending;
  if (toDecimal(amount).greaterThan(remaining)) {
    throw new BusinessRuleError(
      remaining.isZero()
        ? 'Nothing is due on this rental any more'
        : `Only ₹${money(remaining)} is still due on this rental`,
    );
  }
};

interface PaymentTerms {
  paymentDate: string;
  amount: string;
  paymentMode: PaymentRecord['paymentMode'];
  paidById: string;
}

const expenseFields = (rental: RentalRecord, terms: PaymentTerms) => ({
  employeeId: terms.paidById,
  siteId: rental.siteId,
  expenseDate: parseDateOnly(terms.paymentDate),
  amount: terms.amount,
  paymentMode: terms.paymentMode,
  paidTo: rental.vendorName,
  description: [
    `Vehicle rent — ${rental.vehicleType}`,
    rental.vehicleNumber,
    `(${rental.rentalNo})`,
  ]
    .filter(Boolean)
    .join(' '),
});

/** Creates the petty cash expense behind a PETTY_CASH payment; returns its id. */
const createRentExpense = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  rental: RentalRecord,
  terms: PaymentTerms,
): Promise<string> => {
  const fields = expenseFields(rental, terms);
  const [categoryId, expenseNo] = [
    await repository.ensureRentCategory(organizationId, tx),
    await nextDocumentNumber(tx, organizationId, EXPENSE_PREFIX, fields.expenseDate),
  ];

  const expense = await tx.expense.create({
    data: { organizationId, expenseNo, categoryId, ...fields, ...auditCreate() },
    select: { id: true, amount: true, employee: { select: { fullName: true } } },
  });

  await recordAudit({
    action: 'CREATE',
    entityType: 'Expense',
    entityId: expense.id,
    entityLabel: expenseNo,
    changes: diffRecords(null, {
      employee: expense.employee.fullName,
      amount: money(expense.amount),
    }),
    metadata: { vehicleRental: rental.rentalNo },
    db: tx,
  });

  return expense.id;
};

const paymentSnapshot = (payment: PaymentRecord) => ({
  paymentDate: formatDateOnly(payment.paymentDate),
  amount: money(payment.amount),
  paymentMode: payment.paymentMode,
  source: payment.source,
  paidBy: payment.paidBy.fullName,
  referenceNo: payment.referenceNo,
  notes: payment.notes,
  expense: payment.expense?.expenseNo ?? null,
});

/**
 * Who paid. Only `transport:manage` may name someone else; for everyone else a
 * requested payer is ignored, as `employeeId` is on expenses and rentals.
 */
const resolvePaidBy = async (
  organizationId: string,
  requested: string | null | undefined,
  fallback: string,
) => {
  if (!requested || requested === fallback || !actorCan('transport:manage')) return fallback;
  if (!(await findActiveEmployee(organizationId, requested))) {
    throw new BusinessRuleError('The selected person is not an active user');
  }
  return requested;
};

export const addPayment = async (
  rentalId: string,
  input: PaymentInput,
): Promise<VehicleRentalDto> => {
  const organizationId = requireOrg();
  const rental = await loadVisible(organizationId, rentalId);

  if (!canActOn(rental, 'update')) {
    throw new ForbiddenError('You can only record payments on rentals you are in charge of');
  }
  assertNotFuture(input.paymentDate);
  assertWithinDue(rental, input.amount);
  const paidById = await resolvePaidBy(organizationId, input.paidById, getActorId()!);

  await prisma.$transaction(async (tx) => {
    const terms: PaymentTerms = {
      paymentDate: input.paymentDate,
      amount: input.amount,
      paymentMode: input.paymentMode,
      paidById,
    };
    const expenseId =
      input.source === 'PETTY_CASH'
        ? await createRentExpense(tx, organizationId, rental, terms)
        : null;

    const payment = await repository.createPayment(
      {
        organizationId,
        rentalId,
        paymentDate: parseDateOnly(input.paymentDate),
        amount: input.amount,
        paymentMode: input.paymentMode,
        source: input.source,
        paidById,
        referenceNo: input.referenceNo ?? null,
        notes: input.notes ?? null,
        expenseId,
        ...auditCreate(),
      },
      tx,
    );

    await recordAudit({
      action: 'CREATE',
      entityType: 'VehicleRentPayment',
      entityId: payment.id,
      entityLabel: rental.rentalNo,
      changes: diffRecords(null, paymentSnapshot(payment)),
      db: tx,
    });
  });

  return getById(rentalId);
};

const loadPayment = (rental: RentalRecord, paymentId: string) => {
  const payment = rental.payments.find((entry) => entry.id === paymentId);
  if (!payment) throw new NotFoundError('Payment');
  return payment;
};

export const updatePayment = async (
  rentalId: string,
  paymentId: string,
  input: UpdatePaymentInput,
): Promise<VehicleRentalDto> => {
  const organizationId = requireOrg();
  const rental = await loadVisible(organizationId, rentalId);
  const existing = loadPayment(rental, paymentId);

  if (!canActOn(rental, 'update')) {
    throw new ForbiddenError('You can only change payments on rentals you are in charge of');
  }
  if (isPaymentLocked(existing)) {
    throw new BusinessRuleError(
      `Its petty cash expense ${existing.expense!.expenseNo} is approved. Ask an approver to reopen it first.`,
    );
  }

  const terms: PaymentTerms = {
    paymentDate: input.paymentDate ?? formatDateOnly(existing.paymentDate),
    amount: input.amount ?? money(existing.amount),
    paymentMode: input.paymentMode ?? existing.paymentMode,
    paidById: await resolvePaidBy(organizationId, input.paidById, existing.paidById),
  };
  const source = input.source ?? existing.source;

  if (input.paymentDate) assertNotFuture(input.paymentDate);
  assertWithinDue(rental, terms.amount, paymentId);

  const liveExpenseId =
    existing.expense && !existing.expense.deletedAt ? existing.expense.id : null;

  await prisma.$transaction(async (tx) => {
    let expenseId = liveExpenseId;

    if (source === 'PETTY_CASH' && liveExpenseId) {
      // Keep the expense in step. Fixing a rejected one sends it for approval again.
      const resubmit = existing.expense!.status === 'REJECTED';
      await tx.expense.update({
        where: { id: liveExpenseId },
        data: {
          ...expenseFields(rental, terms),
          ...(resubmit
            ? { status: 'PENDING', reviewedById: null, reviewedAt: null, reviewNote: null }
            : {}),
          ...auditUpdate(),
        },
      });
      await recordAudit({
        action: 'UPDATE',
        entityType: 'Expense',
        entityId: liveExpenseId,
        entityLabel: existing.expense!.expenseNo,
        changes: diffRecords(
          { amount: money(existing.amount), expenseDate: formatDateOnly(existing.paymentDate) },
          { amount: money(terms.amount), expenseDate: terms.paymentDate },
        ),
        metadata: { vehicleRental: rental.rentalNo, ...(resubmit ? { resubmitted: true } : {}) },
        db: tx,
      });
    } else if (source === 'PETTY_CASH') {
      expenseId = await createRentExpense(tx, organizationId, rental, terms);
    } else if (liveExpenseId) {
      // Now paid by the office — the employee's expense no longer exists.
      await tx.expense.update({
        where: { id: liveExpenseId },
        data: { isActive: false, deletedAt: new Date(), ...auditUpdate() },
      });
      await recordAudit({
        action: 'DELETE',
        entityType: 'Expense',
        entityId: liveExpenseId,
        entityLabel: existing.expense!.expenseNo,
        metadata: { vehicleRental: rental.rentalNo, reason: 'Rent payment moved to office' },
        db: tx,
      });
      expenseId = null;
    }

    const payment = await repository.updatePayment(
      paymentId,
      {
        paymentDate: parseDateOnly(terms.paymentDate),
        amount: terms.amount,
        paymentMode: terms.paymentMode,
        source,
        paidById: terms.paidById,
        ...(input.referenceNo !== undefined ? { referenceNo: input.referenceNo } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        expenseId,
        ...auditUpdate(),
      },
      tx,
    );

    await recordAudit({
      action: 'UPDATE',
      entityType: 'VehicleRentPayment',
      entityId: paymentId,
      entityLabel: rental.rentalNo,
      changes: diffRecords(paymentSnapshot(existing), paymentSnapshot(payment)),
      db: tx,
    });
  });

  return getById(rentalId);
};

export const removePayment = async (
  rentalId: string,
  paymentId: string,
): Promise<VehicleRentalDto> => {
  const organizationId = requireOrg();
  const rental = await loadVisible(organizationId, rentalId);
  const existing = loadPayment(rental, paymentId);

  if (!canActOn(rental, 'delete')) {
    throw new ForbiddenError('You can only delete payments on rentals you are in charge of');
  }
  if (isPaymentLocked(existing)) {
    throw new BusinessRuleError(
      `Its petty cash expense ${existing.expense!.expenseNo} is approved. Ask an approver to reopen it first.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    if (existing.expense && !existing.expense.deletedAt) {
      await tx.expense.update({
        where: { id: existing.expense.id },
        data: { isActive: false, deletedAt: now, ...auditUpdate() },
      });
      await recordAudit({
        action: 'DELETE',
        entityType: 'Expense',
        entityId: existing.expense.id,
        entityLabel: existing.expense.expenseNo,
        metadata: { vehicleRental: rental.rentalNo, reason: 'Rent payment deleted' },
        db: tx,
      });
    }

    await repository.updatePayment(
      paymentId,
      { isActive: false, deletedAt: now, ...auditUpdate() },
      tx,
    );

    await recordAudit({
      action: 'DELETE',
      entityType: 'VehicleRentPayment',
      entityId: paymentId,
      entityLabel: rental.rentalNo,
      changes: { amount: { from: money(existing.amount), to: null } },
      db: tx,
    });
  });

  return getById(rentalId);
};

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export const exportToCsv = async (query: RentalListQueryInput): Promise<string> => {
  const rentals = await filteredRentals(query);

  await recordAudit({
    action: 'EXPORT',
    entityType: 'VehicleRental',
    entityLabel: `${rentals.length} rows`,
  });

  return toCsv(
    [
      'Rental No',
      'Employee',
      'Site',
      'Vehicle',
      'Vehicle No',
      'Vendor',
      'Vendor Mobile',
      'Driver',
      'From',
      'To',
      'Days',
      'Basis',
      'Rate',
      'Extra',
      'Rent Due',
      'Paid',
      'Pending',
      'Payment Status',
      'Status',
    ],
    rentals.map((rental) => [
      rental.rentalNo,
      rental.employee.fullName,
      rental.site?.name,
      rental.vehicleType,
      rental.vehicleNumber,
      rental.vendorName,
      rental.vendorMobile,
      rental.driverName,
      rental.fromDate,
      rental.toDate,
      rental.days,
      rental.rentBasis,
      rental.rate,
      rental.extraCharges,
      rental.rentDue,
      rental.paidAmount,
      rental.pendingAmount,
      rental.paymentStatus,
      rental.rentalStatus,
    ]),
  );
};
