import type { AuditFields, ISODateString, Paginated, UUID } from '../common.js';
import type { CashEntryType, PaymentMode } from '../enums.js';

/**
 * Petty cash contracts.
 *
 * Money crosses the wire as a decimal *string* ("1250.50"), never a number, so it
 * is never rounded through a float. Calendar dates are "YYYY-MM-DD" strings.
 */

/** "YYYY-MM-DD" */
export type DateOnlyString = string;
/** Decimal amount as a string, e.g. "1250.50". */
export type MoneyString = string;

export interface PersonRef {
  id: UUID;
  fullName: string;
}

export interface NamedRef {
  id: UUID;
  name: string;
}

/* ------------------------------------------------------------------ */
/* Cash book                                                           */
/* ------------------------------------------------------------------ */

export interface CashEntryDto extends AuditFields {
  id: UUID;
  entryNo: string;
  type: CashEntryType;
  employee: PersonRef;
  site: NamedRef | null;
  entryDate: DateOnlyString;
  amount: MoneyString;
  paymentMode: PaymentMode;
  referenceNo: string | null;
  notes: string | null;
  handledBy: PersonRef;
}

/**
 * The cash book list, with totals for the whole filtered set (not just the page).
 * `expenses` is the bills filed over the same employee, site and dates, so the
 * cash book can show what was spent beside what was given.
 */
export interface CashBookListDto extends Paginated<CashEntryDto> {
  totals: {
    given: MoneyString;
    returned: MoneyString;
    net: MoneyString;
    expenses: MoneyString;
    expenseCount: number;
  };
}

export interface CashEntryRequest {
  type: CashEntryType;
  employeeId: UUID;
  siteId?: UUID | null;
  entryDate: DateOnlyString;
  amount: MoneyString | number;
  paymentMode: PaymentMode;
  referenceNo?: string | null;
  notes?: string | null;
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

export interface AttachmentDto {
  id: UUID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: PersonRef;
  createdAt: ISODateString;
}

export interface ExpenseDto extends AuditFields {
  id: UUID;
  expenseNo: string;
  employee: PersonRef;
  site: NamedRef | null;
  category: NamedRef;
  expenseDate: DateOnlyString;
  amount: MoneyString;
  paymentMode: PaymentMode;
  paidTo: string | null;
  /** "Remark" on screen — optional free text. */
  description: string | null;
  attachmentCount: number;
  /** Populated on the detail endpoint only. */
  attachments?: AttachmentDto[];
  /** Whether the caller may still edit / delete this expense. */
  canEdit: boolean;
  /** Set when a vehicle rent payment created this expense — it is changed there. */
  rentPayment: { id: UUID; rentalId: UUID; rentalNo: string } | null;
}

export interface ExpenseRequest {
  /** Only honoured for callers with `expenses:manage`; otherwise the caller. */
  employeeId?: UUID | null;
  siteId?: UUID | null;
  categoryId: UUID;
  expenseDate: DateOnlyString;
  amount: MoneyString | number;
  paymentMode: PaymentMode;
  paidTo?: string | null;
  description?: string | null;
}

/** The expense list, with the total for the whole filtered set (not just the page). */
export interface ExpenseListDto extends Paginated<ExpenseDto> {
  totals: { count: number; amount: MoneyString };
}

/* ------------------------------------------------------------------ */
/* Balances                                                            */
/* ------------------------------------------------------------------ */

/**
 * One employee's position.
 *   balance = cashGiven − cashReturned − expenses
 * Positive: the employee is holding company cash. Negative: the company owes the
 * employee (they spent out of pocket).
 */
export interface BalanceRowDto {
  employee: PersonRef & { mobile: string | null; designation: string | null };
  cashGiven: MoneyString;
  cashReturned: MoneyString;
  expenses: MoneyString;
  expenseCount: number;
  balance: MoneyString;
  lastActivityOn: DateOnlyString | null;
}

export type StatementLineKind = 'CASH_GIVEN' | 'CASH_RETURNED' | 'EXPENSE';

export interface StatementLineDto {
  id: UUID;
  kind: StatementLineKind;
  date: DateOnlyString;
  documentNo: string;
  particulars: string;
  site: string | null;
  /** Money the employee received. */
  credit: MoneyString | null;
  /** Money the employee spent or returned. */
  debit: MoneyString | null;
  runningBalance: MoneyString;
}

export interface StatementDto {
  employee: BalanceRowDto['employee'];
  from: DateOnlyString | null;
  to: DateOnlyString | null;
  openingBalance: MoneyString;
  totalCredit: MoneyString;
  totalDebit: MoneyString;
  closingBalance: MoneyString;
  lines: StatementLineDto[];
}
