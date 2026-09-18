import { formatCurrency, formatNumber } from '@liveconsole-ops/shared';
import type { AmountByName, ExpenseDto } from '@liveconsole-ops/types';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Plus,
  Receipt,
  Truck,
  Wallet,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { StatTile } from '@/components/common/StatTile';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { PageLayout, SectionCard } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { BalanceAmount } from '@/pages/balances/BalancesListPage';
import { dashboardService } from '@/services/dashboard.service';
import { useAuthStore } from '@/store/auth.store';
import { formatDateOnly } from '@/utils/dates';

/**
 * The petty cash dashboard. The same screen serves both audiences: an
 * administrator sees the company (who holds cash, what has been spent), an
 * employee sees themselves (what I received, spent, and hold).
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

const RecentList = ({
  expenses,
  showEmployee,
}: {
  expenses: ExpenseDto[];
  showEmployee: boolean;
}) => {
  if (expenses.length === 0) {
    return <p className="text-xs text-muted-foreground">No expenses yet.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {expenses.map((expense) => (
        <li key={expense.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {expense.description || expense.category.name}
            </p>
            <p className="truncate text-2xs text-muted-foreground">
              {formatDateOnly(expense.expenseDate)} ·{' '}
              {showEmployee ? `${expense.employee.fullName} · ` : ''}
              {expense.site?.name ?? expense.category.name}
            </p>
          </div>
          <p className="numeric shrink-0 text-sm font-semibold">{formatCurrency(expense.amount)}</p>
        </li>
      ))}
    </ul>
  );
};

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const { can } = usePermissions();
  const navigate = useNavigate();

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
          {/* An employee is shown their running totals — received, returned, spent,
              and what is left after it — because that is the question they open this
              screen with. The company view keeps the same figures rolled up. Each
              figure keeps one colour wherever it appears: received green, returned
              amber, spent red, balance blue. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={ArrowDownLeft}
              surface="success"
              label={isCompany ? 'Total given' : 'Total received'}
              value={formatCurrency(data.totals.cashGiven)}
              hint="Cash and UPI, all time"
            />
            <StatTile
              icon={ArrowUpRight}
              surface="warning"
              label="Total returned"
              value={formatCurrency(data.totals.cashReturned)}
              hint={isCompany ? 'Handed back by employees' : 'Handed back to the office'}
            />
            <StatTile
              icon={Receipt}
              surface="danger"
              label="Total expense"
              value={formatCurrency(data.totals.expenses)}
              hint={formatNumber(data.totals.expenseCount) + ' bills'}
            />
            <StatTile
              icon={Wallet}
              surface="info"
              tone={Number(data.totals.balance) < 0 ? 'danger' : 'default'}
              label={isCompany ? 'Cash with employees' : 'Balance'}
              value={formatCurrency(data.totals.balance)}
              hint={
                Number(data.totals.balance) < 0
                  ? isCompany
                    ? 'Employees have spent more than they hold'
                    : 'The office owes you this'
                  : 'Received − returned − expense'
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={CalendarDays}
              surface="success"
              label={isCompany ? `Given in ${monthName}` : `Received in ${monthName}`}
              value={formatCurrency(data.thisMonth.cashGiven)}
            />
            <StatTile
              icon={Receipt}
              surface="danger"
              label={`Spent in ${monthName}`}
              value={formatCurrency(data.thisMonth.expenses)}
            />
          </div>

          {data.transport ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={Truck}
                surface="progress"
                label="Vehicles on rent"
                value={formatNumber(data.transport.onRent)}
                hint={isCompany ? 'Across all sites' : 'In your charge'}
                onClick={() => navigate('/vehicle-rentals?rentalStatus=ON_RENT')}
              />
              <StatTile
                icon={AlertCircle}
                surface="danger"
                label="Vehicle rent to pay"
                value={formatCurrency(data.transport.pending)}
                hint="Rent due minus payments"
                onClick={() => navigate('/vehicle-rentals?paymentStatus=PENDING')}
              />
            </div>
          ) : null}

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
                              {formatCurrency(row.expenses)} spent · {row.expenseCount} bills
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
              title="Latest expenses"
              description={isCompany ? 'The most recent bills filed.' : 'The last bills you filed.'}
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/expenses">
                    All
                    <ArrowRight />
                  </Link>
                </Button>
              }
            >
              <RecentList expenses={data.recentExpenses} showEmployee={isCompany} />
            </SectionCard>

            <SectionCard title={`Spend by site — ${monthName}`} description="This month.">
              <RankedBars rows={data.bySite} empty="No expenses this month." />
            </SectionCard>

            <SectionCard title={`Spend by category — ${monthName}`} description="This month.">
              <RankedBars rows={data.byCategory} empty="No expenses this month." />
            </SectionCard>
          </div>
        </>
      ) : null}
    </PageLayout>
  );
};

export default DashboardPage;
