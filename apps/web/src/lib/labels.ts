import type { PaymentMode, RentBasis, RentPaymentSource } from '@liveconsole-ops/types';

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK: 'Bank',
};

export const RENT_BASIS_LABELS: Record<RentBasis, string> = {
  PER_DAY: 'Per day',
  FIXED: 'Fixed / trip',
};

export const RENT_SOURCE_LABELS: Record<RentPaymentSource, string> = {
  OFFICE: 'Office paid',
  PETTY_CASH: 'From petty cash',
};
