import type { RentPaymentStatus, RentalStatus } from '@liveconsole-ops/types';

import { todayIso } from '@/utils/dates';

const DAY_MS = 86_400_000;

/**
 * Days on rent, both ends counted — to today while the vehicle is still out. The
 * same rule the API uses, so the form's preview matches what gets saved.
 */
export const rentDays = (fromDate: string, toDate: string | null): number => {
  if (!fromDate) return 0;
  const end = toDate ?? todayIso();
  if (end < fromDate) return 0;
  return (
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MS) + 1
  );
};

/** Money still owed gets the attention colour; a settled rental reads as done. */
export const paymentStatusTone = (status: RentPaymentStatus) =>
  status === 'PENDING'
    ? ('danger' as const)
    : status === 'PARTIAL'
      ? ('warning' as const)
      : undefined;

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  UPCOMING: 'Upcoming',
  ON_RENT: 'On rent',
  COMPLETED: 'Returned',
};

export const PAYMENT_STATUS_LABELS: Record<RentPaymentStatus, string> = {
  PENDING: 'Unpaid',
  PARTIAL: 'Part paid',
  PAID: 'Paid',
};
