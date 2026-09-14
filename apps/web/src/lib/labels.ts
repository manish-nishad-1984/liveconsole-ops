import type { PaymentMode } from '@liveconsole-ops/types';

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK: 'Bank',
};
