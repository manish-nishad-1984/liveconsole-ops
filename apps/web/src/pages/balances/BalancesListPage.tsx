import { formatCurrency } from '@liveconsole-ops/shared';
import type { BalanceRowDto } from '@liveconsole-ops/types';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, HandCoins, Receipt, Scale, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DataTable, type DataTableColumnMeta } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { StatTile } from '@/components/common/StatTile';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { balancesService } from '@/services/petty-cash.service';
import { formatDateOnly } from '@/utils/dates';
import { runExport } from '@/utils/download';

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

/** Positive: holding company cash. Negative: the company owes them. */
export const BalanceAmount = ({ value, className }: { value: string; className?: string }) => {
  const amount = Number(value);
  return (
    <span
      className={cn(
        'numeric font-semibold',
        amount < 0 && 'text-status-danger',
        amount === 0 && 'text-muted-foreground',
        className,
      )}
    >
      {formatCurrency(value)}
    </span>
  );
};

const BalancesListPage = () => {
  const navigate = useNavigate();
  const canExport = useCan('balances:export');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: queryKeys.pettyCash.balances({ search }),
    queryFn: () => balancesService.list(search ? { search } : {}),
  });

  const rows = query.data ?? [];
  const totals = useMemo(() => {
    let holding = 0;
    let owed = 0;
    let spent = 0;
    for (const row of rows) {
      const balance = Number(row.balance);
      if (balance > 0) holding += balance;
      else owed += -balance;
      spent += Number(row.expenses);
    }
    return { holding, owed, spent };
  }, [rows]);

  const columns = useMemo<ColumnDef<BalanceRowDto, unknown>[]>(
    () => [
      {
        id: 'employee',
        header: 'Employee',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.employee.fullName}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {[row.original.employee.designation, row.original.employee.mobile]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'cashGiven',
        header: 'Given',
        meta: meta({ numeric: true, priority: 'normal' }),
        cell: ({ row }) => (
          <span className="numeric text-xs">{formatCurrency(row.original.cashGiven)}</span>
        ),
      },
      {
        id: 'cashReturned',
        header: 'Returned',
        meta: meta({ numeric: true, priority: 'low' }),
        cell: ({ row }) => (
          <span className="numeric text-xs">{formatCurrency(row.original.cashReturned)}</span>
        ),
      },
      {
        id: 'expenses',
        header: 'Expenses',
        meta: meta({ numeric: true, priority: 'normal' }),
        cell: ({ row }) => (
          <span className="numeric text-xs">
            {formatCurrency(row.original.expenses)}
            {row.original.expenseCount > 0 ? (
              <span className="block text-2xs text-muted-foreground">
                {row.original.expenseCount} bills
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'balance',
        header: 'Balance',
        meta: meta({ numeric: true }),
        cell: ({ row }) => <BalanceAmount value={row.original.balance} className="text-sm" />,
      },
      {
        id: 'lastActivityOn',
        header: 'Last activity',
        meta: meta({ priority: 'low' }),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateOnly(row.original.lastActivityOn)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <ResourceLayout
      title="Balances"
      description="What each employee holds. Balance = cash given − returned − expenses."
      actions={
        canExport ? (
          <Button
            variant="outline"
            onClick={() =>
              void runExport(
                () => balancesService.exportCsv(search ? { search } : {}),
                'balances.csv',
              )
            }
          >
            <Download />
            Export
          </Button>
        ) : null
      }
      summary={
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={Wallet}
            surface="info"
            label="Cash with employees"
            value={formatCurrency(totals.holding)}
            hint="Given, not yet spent or returned"
          />
          <StatTile
            icon={HandCoins}
            surface="info"
            tone={totals.owed > 0 ? 'danger' : 'default'}
            label="Owed to employees"
            value={formatCurrency(totals.owed)}
            hint="Spent from their own pocket"
          />
          <StatTile
            icon={Receipt}
            surface="danger"
            label="Total expenses"
            value={formatCurrency(totals.spent)}
            hint="Already deducted from balances"
            onClick={() => navigate('/expenses')}
          />
        </div>
      }
    >
      <DataTable
        data={rows}
        columns={columns}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(row) => navigate(row.employee.id)}
        getRowId={(row) => row.employee.id}
        hasActiveFilters={Boolean(search)}
        emptyState={
          <EmptyState
            icon={Scale}
            title="No balances yet"
            description="Employees appear here once they are given cash or file an expense."
          />
        }
        toolbar={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search employee or mobile…"
            className="w-full max-w-xs"
          />
        }
      />
    </ResourceLayout>
  );
};

export default BalancesListPage;
