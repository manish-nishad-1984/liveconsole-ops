import { PaymentMode, RentBasis, RentPaymentSource } from '@prisma/client';
import { RENTAL_STATUSES, RENT_PAYMENT_STATUSES } from '@liveconsole-ops/types';
import { REGEX } from '@liveconsole-ops/shared';
import { z } from 'zod';

import {
  amount,
  dateOnly,
  listQuery,
  optionalText,
  optionalUuid,
  shortText,
  uuid,
} from '../../lib/validators.js';

/** A mobile number that may be left blank. */
const optionalMobile = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || REGEX.PHONE.test(value),
    'Enter a valid 10-digit mobile number',
  )
  .transform((value) => (value === '' ? null : value))
  .nullish();

/** Zero or more rupees, two decimals at most. */
const optionalMoney = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine(
    (value) => value === '' || /^\d{1,10}(\.\d{1,2})?$/.test(value),
    'Enter an amount like 500 or 500.50',
  )
  .transform((value) => (value === '' ? '0' : value))
  .nullish();

const rentalFields = {
  /** Honoured only for `transport:manage`; everyone else is in charge of their own. */
  employeeId: optionalUuid,
  siteId: optionalUuid,
  vehicleType: shortText(60),
  vehicleNumber: optionalText(20),
  vendorName: shortText(120),
  vendorMobile: optionalMobile,
  driverName: optionalText(120),
  driverMobile: optionalMobile,
  fromDate: dateOnly,
  toDate: dateOnly.nullish().or(z.literal('').transform(() => null)),
  rentBasis: z.nativeEnum(RentBasis),
  rate: amount,
  extraCharges: optionalMoney,
  notes: optionalText(500),
};

const periodIsValid = (data: { fromDate?: string; toDate?: string | null }) =>
  !data.fromDate || !data.toDate || data.toDate >= data.fromDate;

const periodMessage = { message: 'The end date cannot be before the start date', path: ['toDate'] };

export const rentalSchema = z
  .object({ ...rentalFields, rentBasis: rentalFields.rentBasis.default('PER_DAY') })
  .refine(periodIsValid, periodMessage);

export const updateRentalSchema = z
  .object(rentalFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' })
  .refine(periodIsValid, periodMessage);

const paymentFields = {
  paymentDate: dateOnly,
  amount,
  paymentMode: z.nativeEnum(PaymentMode),
  source: z.nativeEnum(RentPaymentSource),
  /** Honoured only for `transport:manage`; everyone else records what they paid. */
  paidById: optionalUuid,
  referenceNo: optionalText(80),
  notes: optionalText(500),
};

export const paymentSchema = z.object({
  ...paymentFields,
  paymentMode: paymentFields.paymentMode.default('CASH'),
  source: paymentFields.source.default('OFFICE'),
});

export const updatePaymentSchema = z
  .object(paymentFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const paymentParams = z.object({ id: uuid, paymentId: uuid });

export const rentalListQuerySchema = listQuery.extend({
  employeeId: uuid.optional(),
  siteId: uuid.optional(),
  paymentStatus: z.enum(RENT_PAYMENT_STATUSES).optional(),
  rentalStatus: z.enum(RENTAL_STATUSES).optional(),
  /** Rentals whose period overlaps this range. */
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

/** Sorted in the database; `pendingAmount` is computed, so it is sorted in memory. */
export const RENTAL_SORT_FIELDS = [
  'fromDate',
  'rentalNo',
  'vehicleType',
  'vendorName',
  'createdAt',
  'employee.fullName',
] as const;

export type RentalInput = z.infer<typeof rentalSchema>;
export type UpdateRentalInput = z.infer<typeof updateRentalSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type RentalListQueryInput = z.infer<typeof rentalListQuerySchema>;
