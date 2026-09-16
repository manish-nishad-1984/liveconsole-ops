import type { BalanceRowDto, ExpenseDto, MoneyString } from './petty-cash.dto.js';

export interface AmountByName {
  id: string;
  name: string;
  amount: MoneyString;
}

/**
 * The petty cash dashboard. `scope` says whose numbers these are: an administrator
 * sees the whole company (`all`), an employee sees only their own (`own`).
 */
export interface DashboardSummaryDto {
  scope: 'all' | 'own';
  totals: {
    cashGiven: MoneyString;
    cashReturned: MoneyString;
    expenses: MoneyString;
    expenseCount: number;
    /** Cash currently with employees (own: with me). */
    balance: MoneyString;
  };
  thisMonth: {
    cashGiven: MoneyString;
    expenses: MoneyString;
  };
  /** Employees by balance, largest first. Empty for `own`. */
  employees: BalanceRowDto[];
  /** The latest expenses filed. */
  recentExpenses: ExpenseDto[];
  /** Spend this month. */
  bySite: AmountByName[];
  byCategory: AmountByName[];
  /** Vehicles on rent and rent still to pay. Null without `transport:view`. */
  transport: { onRent: number; pending: MoneyString } | null;
}
