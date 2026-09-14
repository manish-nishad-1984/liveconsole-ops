import { formatCurrency, formatNumber } from '@liveconsole-ops/shared';
import type { AmountByName, ExpenseDto } from '@liveconsole-ops/types';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Clock, Plus, Receipt, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { StatTile } from '@/components/common/StatTile';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { PageLayout, SectionCard } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { BalanceAmount } from '@/pages/balances/BalancesListPage';
import { expenseStatusTone } from '@/pages/expenses/ExpenseDetailSheet';
import { dashboardService } from '@/services/dashboard.service';
import { useAuthStore } from '@/store/auth.store';
import { formatDateOnly } from '@/utils/dates';

/**
 * The petty cash dashboard. The same screen serves both audiences: an
 * administrator sees the company (who holds cash, what waits for approval), an
 * employee sees themselves (my balance, my pending bills).
 */

const monthName = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  timeZone: 'Asia/Kolkata',
}).format(new Date());

/**
 * Ranked spend, one series: a single hue for magnitude, thin bars from a shared
 * baseline, and the value printed in text ink beside each — the bar shows the
 * proportion, the number carries the exact figure.
 */
const RankedBars = ({ rows, empty }: { rows: AmountByName[]; empty: string }) => {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((row) => Number(row.amount)), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const share = Math.max((Number(row.amount) / max) * 100, 1.5);
        return (
          <li key={row.id} className="group" title={`${row.name}: ${formatCurrency(row.amount)}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-foreground">{row.name}</span>
              <span className="numeric shrink-0 font-medium text-foreground">
                {formatCurrency(row.amount)}
              </span>
            </div>
            <div className="h-2 w-full rounded-r bg-muted">
              <div
                className="h-2 rounded-r bg-primary transition-opacity group-hover:opacity-80"
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const PendingList = ({
  expenses,
  showEmployee,
}: {
  expenses: ExpenseDto[];
  showEmployee: boolean;
}) => {
  if (expenses.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing is waiting for approval.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {expenses.map((expense) => (
        <li key={expense.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{expense.description}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {formatDateOnly(expense.expenseDate)} ·{' '}
              {showEmployee ? `${expense.employee.fullName} · ` : ''}
              {expense.site?.name ?? expense.category.name}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="numeric text-sm font-semibold">{formatCurrency(expense.amount)}</p>
            <StatusBadge
              status={expense.status}
              tone={expenseStatusTone(expense.status)}
              withDot={false}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const { can } = usePermissions();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: () => dashboardService.summary(),
  });

  const isCompany = data?.scope === 'all';
  const firstName = user?.fullName.split(' ')[0] ?? 'there';

  return (
    <PageLayout
      title={`Welcome, ${firstName}`}
      description={isCompany ? 'Petty cash across all employees.' : 'Your petty cash at a glance.'}
      actions={
        can('expenses:create') ? (
          <Button asChild>
            <Link to="/expenses?new=1">
              <Plus />
              Add expense
            </Link>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <LoadingState variant="cards" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={Wallet}
              tone={Number(data.totals.balance) < 0 ? 'danger' : 'default'}
              label={isCompany ? 'Cash with employees' : 'My balance'}
              value={formatCurrency(data.totals.balance)}
              hint={
                isCompany
                  ? 'Given − returned − approved'
                  : Number(data.totals.balance) < 0
                    ? 'The office owes you this'
                    : 'Cash in hand'
              }
            />
            <StatTile
              icon={Clock}
              tone="warning"
              label="Waiting for approval"
              value={formatCurrency(data.totals.pendingExpenses)}
              hint={`${formatNumber(data.totals.pendingCount)} bills`}
            />
            <StatTile
              icon={CalendarDays}
              tone="success"
              label={isCompany ? `Given in ${monthName}` : `Received in ${monthName}`}
              value={formatCurrency(data.thisMonth.cashGiven)}
            />
            <StatTile
              icon={Receipt}
              label={`Spent in ${monthName}`}
              value={formatCurrency(data.thisMonth.submittedExpenses)}
              hint={`${formatCurrency(data.thisMonth.approvedExpenses)} approved`}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {isCompany ? (
              <SectionCard
                title="Employee balances"
                description="Who is holding the most company cash."
                actions={
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/balances">
                      All
                      <ArrowRight />
                    </Link>
                  </Button>
                }
              >
                {data.employees.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No cash has been given yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.employees.map((row) => (
                      <li key={row.employee.id}>
                        <Link
                          to={`/balances/${row.employee.id}`}
                          className="flex items-center gap-3 py-2.5 hover:bg-accent/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{row.employee.fullName}</p>
                            <p className="truncate text-2xs text-muted-foreground">
                              {row.pendingCount > 0
                                ? `${row.pendingCount} pending · ${formatCurrency(row.pendingExpenses)}`
                                : 'No pending bills'}
                            </p>
                          </div>
                          <BalanceAmount value={row.balance} className="text-sm" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            ) : null}

            <SectionCard
              title="Waiting for approval"
              description={
                isCompany ? 'Latest bills to check.' : 'Your bills the office has not approved yet.'
              }
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/expenses?status=PENDING">
                    All
                    <ArrowRight />
                  </Link>
                </Button>
              }
            >
              <PendingList expenses={data.pendingExpenses} showEmployee={isCompany} />
            </SectionCard>

            <SectionCard title={`Spend by site — ${monthName}`} description="Approved and pending.">
              <RankedBars rows={data.bySite} empty="No expenses this month." />
            </SectionCard>

            <SectionCard
              title={`Spend by category — ${monthName}`}
              description="Approved and pending."
            >
              <RankedBars rows={data.byCategory} empty="No expenses this month." />
            </SectionCard>
          </div>
        </>
      ) : null}
    </PageLayout>
  );
};

export default DashboardPage;
