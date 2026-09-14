import { formatCurrency, formatNumber } from '@liveconsole-ops/shared';
import type { ExpenseDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCheck,
  CircleCheck,
  CircleX,
  Clock,
  Download,
  Paperclip,
  Plus,
  Receipt,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useListQuery } from '@/hooks/use-list-query';
import { useCategoryOptions, useEmployeeOptions, useSiteOptions } from '@/hooks/use-options';
import { usePermissions } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { ExpenseDetailSheet, expenseStatusTone } from '@/pages/expenses/ExpenseDetailSheet';
import { ExpenseFormModal } from '@/pages/expenses/ExpenseFormModal';
import { expensesService } from '@/services/petty-cash.service';
import { formatDateOnly } from '@/utils/dates';
import { runExport } from '@/utils/download';

/**
 * Expenses. An employee sees and files their own; an approver sees everyone's,
 * opens one to check the receipt, and approves — or ticks a batch that has been
 * checked and approves them together.
 */

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const ExpensesListPage = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const seeAll = can('expenses:manage') || can('expenses:approve');
  const canApprove = can('expenses:approve');
  const list = useListQuery({
    defaultSortBy: 'expenseDate',
    defaultSortDir: 'desc',
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseDto | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseDto | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  // `?new=1` (from the dashboard's "Add expense") opens the form straight away.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null);
      setFormOpen(true);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('new');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const employees = useEmployeeOptions(seeAll);
  const sites = useSiteOptions();
  const categories = useCategoryOptions();

  const query = useQuery({
    queryKey: queryKeys.pettyCash.expenses(list.params),
    queryFn: () => expensesService.list(list.params),
  });

  // A selection only makes sense for rows that are on screen and still pending.
  useEffect(() => {
    setSelected(new Set());
  }, [list.params]);

  const items = query.data?.items ?? [];
  const selectable = items.filter((expense) => expense.status === 'PENDING');
  const selectedTotal = items
    .filter((expense) => selected.has(expense.id))
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesService.remove(id),
    onSuccess: (expense) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
      setConfirmDelete(null);
      setViewingId(null);
      toast.success(`${expense.expenseNo} deleted`);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: () => expensesService.bulkApprove([...selected]),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
      setSelected(new Set());
      setConfirmBulk(false);
      toast.success(
        `${result.approved} expense${result.approved === 1 ? '' : 's'} approved` +
          (result.skipped ? ` · ${result.skipped} skipped (no longer pending)` : ''),
      );
    },
  });

  const columns = useMemo<ColumnDef<ExpenseDto, unknown>[]>(() => {
    const toggle = (id: string, checked: boolean) =>
      setSelected((current) => {
        const next = new Set(current);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });

    return [
      ...(canApprove
        ? [
            {
              id: 'select',
              enableHiding: false,
              meta: meta({ cellClassName: 'w-8' }),
              header: () => (
                <Checkbox
                  aria-label="Select all pending on this page"
                  checked={
                    selectable.length > 0 && selectable.every((expense) => selected.has(expense.id))
                  }
                  disabled={selectable.length === 0}
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked === true
                        ? new Set(selectable.map((expense) => expense.id))
                        : new Set(),
                    )
                  }
                />
              ),
              cell: ({ row }) =>
                row.original.status === 'PENDING' ? (
                  <span onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${row.original.expenseNo}`}
                      checked={selected.has(row.original.id)}
                      onCheckedChange={(checked) => toggle(row.original.id, checked === true)}
                    />
                  </span>
                ) : null,
            } satisfies ColumnDef<ExpenseDto, unknown>,
          ]
        : []),
      {
        id: 'expenseDate',
        header: 'Date',
        meta: meta({ sortKey: 'expenseDate' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-xs font-medium">
              {formatDateOnly(row.original.expenseDate)}
            </p>
            <p className="numeric text-2xs text-muted-foreground">{row.original.expenseNo}</p>
          </div>
        ),
      },
      ...(seeAll
        ? [
            {
              id: 'employee.fullName',
              header: 'Employee',
              meta: meta({ sortKey: 'employee.fullName', priority: 'normal' }),
              cell: ({ row }) => <span className="text-sm">{row.original.employee.fullName}</span>,
            } satisfies ColumnDef<ExpenseDto, unknown>,
          ]
        : []),
      {
        id: 'description',
        header: 'Expense',
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[20rem]">
            <p className="truncate text-sm font-medium">{row.original.description}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {row.original.site.name} · {row.original.category.name}
              {row.original.paidTo ? ` · ${row.original.paidTo}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        meta: meta({ sortKey: 'amount', numeric: true }),
        cell: ({ row }) => (
          <span className="numeric text-sm font-semibold">
            {formatCurrency(row.original.amount)}
          </span>
        ),
      },
      {
        id: 'receipts',
        header: '',
        meta: meta({ priority: 'low', cellClassName: 'w-10' }),
        cell: ({ row }) =>
          row.original.attachmentCount > 0 ? (
            <span
              className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground"
              title={`${row.original.attachmentCount} receipt(s)`}
            >
              <Paperclip className="size-3.5" />
              {row.original.attachmentCount}
            </span>
          ) : (
            <span className="text-2xs text-status-warning" title="No receipt attached">
              —
            </span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        meta: meta({ sortKey: 'status' }),
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} tone={expenseStatusTone(row.original.status)} />
        ),
      },
    ];
  }, [canApprove, seeAll, selectable, selected]);

  const summary = query.data?.summary;
  const statusFilter = list.filters.status;
  const setStatus = (status: string) =>
    list.setFilter('status', statusFilter === status ? null : status);

  return (
    <ResourceLayout
      title="Expenses"
      description={
        seeAll
          ? 'Site expenses from every employee. Open one to check the receipt and approve it.'
          : 'Your site expenses. Approved ones are deducted from the cash you hold.'
      }
      actions={
        <>
          {can('expenses:export') ? (
            <Button
              variant="outline"
              onClick={() =>
                void runExport(() => expensesService.exportCsv(list.params), 'expenses.csv')
              }
            >
              <Download />
              Export
            </Button>
          ) : null}
          {can('expenses:create') ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Add expense
            </Button>
          ) : null}
        </>
      }
      summary={
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={Clock}
            tone="warning"
            label="Pending"
            value={formatCurrency(summary?.pending.amount ?? 0)}
            hint={`${formatNumber(summary?.pending.count ?? 0)} waiting for approval`}
            onClick={() => setStatus('PENDING')}
            active={statusFilter === 'PENDING'}
          />
          <StatTile
            icon={CircleCheck}
            tone="success"
            label="Approved"
            value={formatCurrency(summary?.approved.amount ?? 0)}
            hint={`${formatNumber(summary?.approved.count ?? 0)} expenses`}
            onClick={() => setStatus('APPROVED')}
            active={statusFilter === 'APPROVED'}
          />
          <StatTile
            icon={CircleX}
            tone="danger"
            label="Rejected"
            value={formatCurrency(summary?.rejected.amount ?? 0)}
            hint={`${formatNumber(summary?.rejected.count ?? 0)} expenses`}
            onClick={() => setStatus('REJECTED')}
            active={statusFilter === 'REJECTED'}
          />
        </div>
      }
    >
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-accent/60 px-4 py-2.5">
          <p className="text-sm">
            <span className="font-semibold">{selected.size}</span> selected ·{' '}
            <span className="numeric font-semibold">{formatCurrency(selectedTotal)}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setConfirmBulk(true)}>
              <CheckCheck />
              Approve selected
            </Button>
          </div>
        </div>
      ) : null}

      <DataTable
        data={items}
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
        onRowClick={(expense) => setViewingId(expense.id)}
        getRowId={(row) => row.id}
        hasActiveFilters={list.hasActiveFilters}
        emptyState={
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            description={
              can('expenses:create')
                ? 'Add what you spend at site, with a photo of the bill.'
                : undefined
            }
          />
        }
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search expense, paid to, site…"
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
            <OptionSelect
              options={sites.data}
              value={list.filters.siteId ?? null}
              onChange={(value) => list.setFilter('siteId', value)}
              emptyLabel="All sites"
              className="h-9 w-40"
              aria-label="Filter by site"
            />
            <OptionSelect
              options={categories.data}
              value={list.filters.categoryId ?? null}
              onChange={(value) => list.setFilter('categoryId', value)}
              emptyLabel="All categories"
              className="h-9 w-40"
              aria-label="Filter by category"
            />
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

      <ExpenseDetailSheet
        expenseId={viewingId}
        onOpenChange={(open) => !open && setViewingId(null)}
        onEdit={(expense) => {
          setViewingId(null);
          setEditing(expense);
          setFormOpen(true);
        }}
        onDelete={(expense) => setConfirmDelete(expense)}
      />

      <ExpenseFormModal open={formOpen} onOpenChange={setFormOpen} expense={editing} />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.expenseNo ?? 'this expense'}?`}
        description={
          confirmDelete
            ? `${formatCurrency(confirmDelete.amount)} — ${confirmDelete.description}`
            : undefined
        }
        confirmLabel="Delete expense"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
        }}
      />

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        variant="info"
        title={`Approve ${selected.size} expense${selected.size === 1 ? '' : 's'}?`}
        description={`${formatCurrency(selectedTotal)} in total. Each employee's balance is reduced by their approved amount.`}
        confirmLabel="Approve"
        loading={bulkMutation.isPending}
        onConfirm={() => bulkMutation.mutate()}
      />
    </ResourceLayout>
  );
};

export default ExpensesListPage;
