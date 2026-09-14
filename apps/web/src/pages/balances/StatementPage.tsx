import { formatCurrency } from '@liveconsole-ops/shared';
import type { StatementLineDto } from '@liveconsole-ops/types';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Download,
  FileText,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { DataTable, type DataTableColumnMeta } from '@/components/common/DataTable';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { StatTile } from '@/components/common/StatTile';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-permissions';
import { PageLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { BalanceAmount } from '@/pages/balances/BalancesListPage';
import { balancesService } from '@/services/petty-cash.service';
import { useAuthStore } from '@/store/auth.store';
import { formatDateOnly } from '@/utils/dates';
import { runExport } from '@/utils/download';

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

/**
 * An employee's running statement: opening balance, every cash entry and approved
 * expense in date order with the balance after each, then the closing balance.
 * This is the page both sides look at when the numbers are being settled.
 */
const StatementPage = () => {
  const { userId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const canSeeAll = useCan('balances:manage');
  const canExport = useCan('balances:export');
  const isMe = useAuthStore((state) => state.user?.id === userId);

  const params = useMemo(() => {
    const result: Record<string, string> = {};
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from) result.from = from;
    if (to) result.to = to;
    return result;
  }, [searchParams]);

  const query = useQuery({
    queryKey: queryKeys.pettyCash.statement(userId, params),
    queryFn: () => balancesService.statement(userId, params),
    enabled: Boolean(userId),
  });

  const data = query.data;

  const columns = useMemo<ColumnDef<StatementLineDto, unknown>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <div>
            <p className="whitespace-nowrap text-xs font-medium">
              {formatDateOnly(row.original.date)}
            </p>
            <p className="numeric text-2xs text-muted-foreground">{row.original.documentNo}</p>
          </div>
        ),
      },
      {
        id: 'particulars',
        header: 'Particulars',
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[24rem]">
            <p className="truncate text-sm">{row.original.particulars}</p>
            {row.original.site ? (
              <p className="truncate text-2xs text-muted-foreground">{row.original.site}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'credit',
        header: 'Received',
        meta: meta({ numeric: true }),
        cell: ({ row }) =>
          row.original.credit ? (
            <span className="numeric text-sm text-status-success">
              {formatCurrency(row.original.credit)}
            </span>
          ) : null,
      },
      {
        id: 'debit',
        header: 'Spent / returned',
        meta: meta({ numeric: true }),
        cell: ({ row }) =>
          row.original.debit ? (
            <span className="numeric text-sm">{formatCurrency(row.original.debit)}</span>
          ) : null,
      },
      {
        id: 'runningBalance',
        header: 'Balance',
        meta: meta({ numeric: true }),
        cell: ({ row }) => (
          <BalanceAmount value={row.original.runningBalance} className="text-sm" />
        ),
      },
    ],
    [],
  );

  const title = data ? (isMe ? 'My balance' : data.employee.fullName) : 'Statement';

  return (
    <PageLayout
      title={title}
      description={
        data
          ? [data.employee.designation, data.employee.mobile].filter(Boolean).join(' · ') ||
            'Cash received, expenses approved and the balance after each.'
          : undefined
      }
      actions={
        <>
          {canSeeAll ? (
            <Button variant="ghost" asChild>
              <Link to="..">
                <ArrowLeft />
                All balances
              </Link>
            </Button>
          ) : null}
          {canExport ? (
            <Button
              variant="outline"
              onClick={() =>
                void runExport(
                  () => balancesService.exportStatementCsv(userId, params),
                  'statement.csv',
                )
              }
            >
              <Download />
              Export
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label={params.from ? `Opening (${formatDateOnly(params.from)})` : 'Opening'}
          value={formatCurrency(data?.openingBalance ?? 0)}
        />
        <StatTile
          icon={ArrowUpRight}
          tone="success"
          label="Received"
          value={formatCurrency(data?.totalCredit ?? 0)}
        />
        <StatTile
          icon={ArrowDownLeft}
          label="Spent / returned"
          value={formatCurrency(data?.totalDebit ?? 0)}
        />
        <StatTile
          icon={Wallet}
          tone={Number(data?.closingBalance ?? 0) < 0 ? 'danger' : 'default'}
          label="Closing balance"
          value={formatCurrency(data?.closingBalance ?? 0)}
          hint={Number(data?.closingBalance ?? 0) < 0 ? 'Office owes this amount' : 'Cash in hand'}
        />
      </div>

      {data && data.pending.count > 0 ? (
        <Link
          to={`/expenses?status=PENDING${canSeeAll ? `&employeeId=${userId}` : ''}`}
          className="flex items-center gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 px-4 py-2.5 text-sm text-status-warning"
        >
          <Clock className="size-4" />
          {data.pending.count} expense{data.pending.count === 1 ? '' : 's'} (
          {formatCurrency(data.pending.amount)}) waiting for approval — not included above.
        </Link>
      ) : null}

      <DataTable
        data={data?.lines ?? []}
        columns={columns}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        getRowId={(row) => row.id}
        enableColumnVisibility={false}
        hasActiveFilters={Boolean(params.from || params.to)}
        emptyState={
          <EmptyState
            icon={FileText}
            title="Nothing in this period"
            description="Cash entries and approved expenses appear here."
          />
        }
        toolbar={
          <>
            <DateRangeFilter
              from={params.from}
              to={params.to}
              onChange={({ from, to }) =>
                setSearchParams(
                  () => {
                    const next = new URLSearchParams();
                    if (from) next.set('from', from);
                    if (to) next.set('to', to);
                    return next;
                  },
                  { replace: true },
                )
              }
            />
            {params.from || params.to ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchParams({}, { replace: true })}
              >
                All time
              </Button>
            ) : null}
          </>
        }
      />
    </PageLayout>
  );
};

export default StatementPage;
