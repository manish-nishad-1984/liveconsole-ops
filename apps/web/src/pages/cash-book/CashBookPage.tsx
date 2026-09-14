import { formatCurrency } from '@liveconsole-ops/shared';
import type { CashEntryDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type DataTableColumnMeta } from '@/components/common/DataTable';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { OptionSelect } from '@/components/common/OptionSelect';
import { SearchInput } from '@/components/common/SearchInput';
import { StatTile } from '@/components/common/StatTile';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useListQuery } from '@/hooks/use-list-query';
import { useEmployeeOptions } from '@/hooks/use-options';
import { usePermissions } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { PAYMENT_MODE_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { CashEntryFormModal } from '@/pages/cash-book/CashEntryFormModal';
import { cashBookService } from '@/services/petty-cash.service';
import { formatDateOnly } from '@/utils/dates';
import { runExport } from '@/utils/download';

/**
 * The cash book. Administrators record every rupee handed to an employee and
 * every rupee handed back; an employee sees the same list, limited to their own
 * entries, so both sides are looking at the same record.
 */

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const TYPE_FILTER = [
  { value: 'ALL', label: 'Given & returned' },
  { value: 'GIVEN', label: 'Given' },
  { value: 'RETURNED', label: 'Returned' },
] as const;

const CashBookPage = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const seeAll = can('cash_book:manage');
  const list = useListQuery({
    defaultSortBy: 'entryDate',
    defaultSortDir: 'desc',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CashEntryDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CashEntryDto | null>(null);

  const employees = useEmployeeOptions(seeAll);

  const query = useQuery({
    queryKey: queryKeys.pettyCash.cashBook(list.params),
    queryFn: () => cashBookService.list(list.params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cashBookService.remove(id),
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
      setConfirmDelete(null);
      toast.success(`${entry.entryNo} deleted`);
    },
  });

  const columns = useMemo<ColumnDef<CashEntryDto, unknown>[]>(
    () => [
      {
        id: 'entryDate',
        header: 'Date',
        meta: meta({ sortKey: 'entryDate' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-xs font-medium">
              {formatDateOnly(row.original.entryDate)}
            </p>
            <p className="numeric text-2xs text-muted-foreground">{row.original.entryNo}</p>
          </div>
        ),
      },
      ...(seeAll
        ? [
            {
              id: 'employee.fullName',
              header: 'Employee',
              meta: meta({ sortKey: 'employee.fullName' }),
              cell: ({ row }) => (
                <span className="text-sm font-medium">{row.original.employee.fullName}</span>
              ),
            } satisfies ColumnDef<CashEntryDto, unknown>,
          ]
        : []),
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => <StatusBadge status={row.original.type} />,
      },
      {
        id: 'amount',
        header: 'Amount',
        meta: meta({ sortKey: 'amount', numeric: true }),
        cell: ({ row }) => (
          <span
            className={cn(
              'numeric text-sm font-semibold',
              row.original.type === 'RETURNED' && 'text-status-info',
            )}
          >
            {row.original.type === 'RETURNED' ? '−' : ''}
            {formatCurrency(row.original.amount)}
          </span>
        ),
      },
      {
        id: 'mode',
        header: 'Mode',
        meta: meta({ priority: 'normal' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-xs">{PAYMENT_MODE_LABELS[row.original.paymentMode]}</p>
            {row.original.referenceNo ? (
              <p className="truncate text-2xs text-muted-foreground">{row.original.referenceNo}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'site',
        header: 'Site / notes',
        meta: meta({ priority: 'low' }),
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate text-xs">{row.original.site?.name ?? '—'}</p>
            {row.original.notes ? (
              <p className="truncate text-2xs text-muted-foreground">{row.original.notes}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'handledBy',
        header: 'By',
        meta: meta({ priority: 'low' }),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.handledBy.fullName}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: meta({ cellClassName: 'w-10' }),
        cell: ({ row }) => {
          if (!can('cash_book:update') && !can('cash_book:delete')) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${row.original.entryNo}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {can('cash_book:update') ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(row.original);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                ) : null}
                {can('cash_book:delete') ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setConfirmDelete(row.original)}>
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [can, seeAll],
  );

  const totals = query.data?.totals;

  return (
    <ResourceLayout
      title="Cash Book"
      description={
        seeAll
          ? 'Cash and UPI handed to employees, and cash they returned.'
          : 'Cash you received from the office, and cash you returned.'
      }
      actions={
        <>
          {can('cash_book:export') ? (
            <Button
              variant="outline"
              onClick={() =>
                void runExport(() => cashBookService.exportCsv(list.params), 'cash-book.csv')
              }
            >
              <Download />
              Export
            </Button>
          ) : null}
          {can('cash_book:create') ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Give cash
            </Button>
          ) : null}
        </>
      }
      summary={
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={ArrowUpRight}
            tone="success"
            label={seeAll ? 'Given' : 'Received'}
            value={formatCurrency(totals?.given ?? 0)}
            hint={list.hasActiveFilters ? 'For the current filters' : 'All time'}
          />
          <StatTile
            icon={ArrowDownLeft}
            label="Returned"
            value={formatCurrency(totals?.returned ?? 0)}
          />
          <StatTile
            icon={Wallet}
            label="Net"
            value={formatCurrency(totals?.net ?? 0)}
            hint="Given − returned"
          />
        </div>
      }
    >
      <DataTable
        data={query.data?.items ?? []}
        columns={columns}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        pagination={query.data?.pagination}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.toggleSort}
        getRowId={(row) => row.id}
        hasActiveFilters={list.hasActiveFilters}
        emptyState={
          <EmptyState
            icon={Wallet}
            title="No cash entries yet"
            description={
              seeAll
                ? 'Record cash or UPI given to an employee with "Give cash".'
                : 'Cash given to you by the office shows up here.'
            }
          />
        }
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search entry no, reference, notes…"
              className="w-full max-w-xs"
            />
            {seeAll ? (
              <OptionSelect
                options={employees.data}
                value={list.filters.employeeId ?? null}
                onChange={(value) => list.setFilter('employeeId', value)}
                emptyLabel="All employees"
                className="h-9 w-44"
                aria-label="Filter by employee"
              />
            ) : null}
            <Select
              value={list.filters.type ?? 'ALL'}
              onValueChange={(value) => list.setFilter('type', value === 'ALL' ? null : value)}
            >
              <SelectTrigger className="h-9 w-40" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTER.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter
              from={list.filters.from}
              to={list.filters.to}
              onChange={({ from, to }) => list.setFilters({ from, to })}
            />
            {list.hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={list.clearFilters}>
                Clear
              </Button>
            ) : null}
          </>
        }
      />

      <CashEntryFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editing}
        defaultEmployeeId={list.filters.employeeId}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.entryNo ?? 'this entry'}?`}
        description={
          confirmDelete
            ? `${formatCurrency(confirmDelete.amount)} ${confirmDelete.type === 'GIVEN' ? 'given to' : 'returned by'} ${confirmDelete.employee.fullName}. Their balance changes immediately.`
            : undefined
        }
        confirmLabel="Delete entry"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
        }}
      />
    </ResourceLayout>
  );
};

export default CashBookPage;
