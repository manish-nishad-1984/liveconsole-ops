import { formatCurrency, formatNumber } from '@liveconsole-ops/shared';
import type { ExpenseDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Paperclip, Plus, Receipt } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { useListQuery } from '@/hooks/use-list-query';
import { useCategoryOptions, useEmployeeOptions, useSiteOptions } from '@/hooks/use-options';
import { usePermissions } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { ExpenseDetailSheet } from '@/pages/expenses/ExpenseDetailSheet';
import { ExpenseFormModal } from '@/pages/expenses/ExpenseFormModal';
import { expensesService } from '@/services/petty-cash.service';
import { formatDateOnly } from '@/utils/dates';
import { runExport } from '@/utils/download';

/**
 * Expenses. An employee sees and files their own; `expenses:manage` sees
 * everyone's. An expense counts against the balance as soon as it is filed —
 * there is nothing here to approve.
 */

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const ExpensesListPage = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const seeAll = can('expenses:manage');
  const list = useListQuery({
    defaultSortBy: 'expenseDate',
    defaultSortDir: 'desc',
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseDto | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseDto | null>(null);

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

  const items = query.data?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesService.remove(id),
    onSuccess: (expense) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
      setConfirmDelete(null);
      setViewingId(null);
      toast.success(`${expense.expenseNo} deleted`);
    },
  });

  const columns = useMemo<ColumnDef<ExpenseDto, unknown>[]>(
    () => [
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
        cell: ({ row }) => {
          const { description, category, site, paidTo } = row.original;
          // The remark is optional, so an expense without one is titled by its
          // category — and then the line below does not repeat it.
          const details = [site?.name, description ? category.name : null, paidTo].filter(Boolean);
          return (
            <div className="min-w-0 max-w-[20rem]">
              <p className="truncate text-sm font-medium">{description || category.name}</p>
              <p className="truncate text-2xs text-muted-foreground">{details.join(' · ')}</p>
            </div>
          );
        },
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
    ],
    [seeAll],
  );

  return (
    <ResourceLayout
      title="Expenses"
      description={
        seeAll
          ? 'Site expenses from every employee, with their receipts.'
          : 'Your site expenses. Each one is deducted from the cash you hold.'
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
            icon={Receipt}
            surface="danger"
            label={list.hasActiveFilters ? 'Total (filtered)' : 'Total expenses'}
            value={formatCurrency(query.data?.totals.amount ?? 0)}
            hint={formatNumber(query.data?.totals.count ?? 0) + ' expenses'}
          />
        </div>
      }
    >
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
            ? `${formatCurrency(confirmDelete.amount)} — ${confirmDelete.description || confirmDelete.category.name}`
            : undefined
        }
        confirmLabel="Delete expense"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
        }}
      />

    </ResourceLayout>
  );
};

export default ExpensesListPage;
