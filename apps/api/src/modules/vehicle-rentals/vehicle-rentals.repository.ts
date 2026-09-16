import type { Prisma } from '@prisma/client';

import { parseDateOnly } from '../../lib/money.js';
import { resolveOrderBy } from '../../lib/pagination.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { and, equals, searchAcross } from '../../lib/query.js';
import { RENTAL_SORT_FIELDS, type RentalListQueryInput } from './vehicle-rentals.schema.js';

export const paymentSelect = {
  id: true,
  rentalId: true,
  paymentDate: true,
  amount: true,
  paymentMode: true,
  source: true,
  paidById: true,
  paidBy: { select: { id: true, fullName: true } },
  referenceNo: true,
  notes: true,
  expenseId: true,
  expense: { select: { id: true, expenseNo: true, deletedAt: true } },
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} satisfies Prisma.VehicleRentPaymentSelect;

export type PaymentRecord = Prisma.VehicleRentPaymentGetPayload<{
  select: typeof paymentSelect;
}>;

/** Payments ride along on every rental: rent due and paid are computed from them. */
export const rentalSelect = {
  id: true,
  rentalNo: true,
  employeeId: true,
  employee: { select: { id: true, fullName: true } },
  siteId: true,
  site: { select: { id: true, name: true } },
  vehicleType: true,
  vehicleNumber: true,
  vendorName: true,
  vendorMobile: true,
  driverName: true,
  driverMobile: true,
  fromDate: true,
  toDate: true,
  rentBasis: true,
  rate: true,
  extraCharges: true,
  notes: true,
  payments: {
    where: { deletedAt: null },
    select: paymentSelect,
    orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
  },
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} satisfies Prisma.VehicleRentalSelect;

export type RentalRecord = Prisma.VehicleRentalGetPayload<{
  select: typeof rentalSelect;
}>;

/** A list is never paged in the database — statuses are computed — so it is capped. */
const MAX_ROWS = 5000;

/** `employeeScope` null = every employee; otherwise only rentals that employee is in charge of. */
const buildWhere = (
  organizationId: string,
  query: RentalListQueryInput,
  employeeScope: string | null,
): Prisma.VehicleRentalWhereInput =>
  and(
    { organizationId, deletedAt: null },
    employeeScope ? { employeeId: employeeScope } : equals('employeeId', query.employeeId),
    equals('siteId', query.siteId),
    // Overlap: started on or before `to`, and not ended before `from`.
    query.to ? { fromDate: { lte: parseDateOnly(query.to) } } : undefined,
    query.from
      ? { OR: [{ toDate: null }, { toDate: { gte: parseDateOnly(query.from) } }] }
      : undefined,
    searchAcross(query.search, [
      'rentalNo',
      'vehicleType',
      'vehicleNumber',
      'vendorName',
      'driverName',
      'employee.fullName',
      'site.name',
    ]),
  ) as Prisma.VehicleRentalWhereInput;

export const listRentals = (
  organizationId: string,
  query: RentalListQueryInput,
  employeeScope: string | null,
) => {
  const orderBy = resolveOrderBy(query.sortBy, query.sortDir, RENTAL_SORT_FIELDS, {
    field: 'fromDate',
    dir: 'desc',
  }) as Prisma.VehicleRentalOrderByWithRelationInput;

  return prisma.vehicleRental.findMany({
    where: buildWhere(organizationId, query, employeeScope),
    select: rentalSelect,
    orderBy: [orderBy, { createdAt: 'desc' }],
    take: MAX_ROWS,
  });
};

export const findRentalById = (
  organizationId: string,
  id: string,
  employeeScope: string | null,
  db: Db = prisma,
) =>
  db.vehicleRental.findFirst({
    where: {
      id,
      organizationId,
      deletedAt: null,
      ...(employeeScope ? { employeeId: employeeScope } : {}),
    },
    select: rentalSelect,
  });

export const createRental = (data: Prisma.VehicleRentalUncheckedCreateInput, db: Db) =>
  db.vehicleRental.create({ data, select: rentalSelect });

export const updateRental = (
  id: string,
  data: Prisma.VehicleRentalUncheckedUpdateInput,
  db: Db = prisma,
) => db.vehicleRental.update({ where: { id }, data, select: rentalSelect });

export const createPayment = (data: Prisma.VehicleRentPaymentUncheckedCreateInput, db: Db) =>
  db.vehicleRentPayment.create({ data, select: paymentSelect });

export const updatePayment = (
  id: string,
  data: Prisma.VehicleRentPaymentUncheckedUpdateInput,
  db: Db = prisma,
) => db.vehicleRentPayment.update({ where: { id }, data, select: paymentSelect });

export const findActiveSite = (organizationId: string, id: string) =>
  prisma.site.findFirst({
    where: { id, organizationId, deletedAt: null, isActive: true },
    select: { id: true },
  });

export const RENT_CATEGORY_NAME = 'Vehicle Rent';

/**
 * The category petty cash rent payments are booked under. Created on first use,
 * so an organisation seeded before transport existed still gets it.
 */
export const ensureRentCategory = async (organizationId: string, db: Db): Promise<string> => {
  const existing = await db.expenseCategory.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      name: { equals: RENT_CATEGORY_NAME, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.expenseCategory.create({
    data: { organizationId, name: RENT_CATEGORY_NAME, sortOrder: 55 },
    select: { id: true },
  });
  return created.id;
};

/** Values typed before, most used first — suggestions for the rental form. */
export const listSuggestions = async (organizationId: string) => {
  const where = { organizationId, deletedAt: null };
  const [types, vendors] = await Promise.all([
    prisma.vehicleRental.groupBy({
      by: ['vehicleType'],
      where,
      _count: { _all: true },
      orderBy: { _count: { vehicleType: 'desc' } },
      take: 30,
    }),
    prisma.vehicleRental.groupBy({
      by: ['vendorName', 'vendorMobile'],
      where,
      _count: { _all: true },
      orderBy: { _count: { vendorName: 'desc' } },
      take: 50,
    }),
  ]);
  return { types, vendors };
};
