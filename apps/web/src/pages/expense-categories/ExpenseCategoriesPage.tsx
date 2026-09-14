import type { ExpenseCategoryDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type DataTableColumnMeta } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useListQuery } from '@/hooks/use-list-query';
import { usePermissions } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { CategoryFormModal } from '@/pages/expense-categories/CategoryFormModal';
import { expenseCategoriesService } from '@/services/masters.service';

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const ExpenseCategoriesPage = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const list = useListQuery({
    defaultSortBy: 'sortOrder',
    defaultSortDir: 'asc',
    defaultPageSize: 50,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategoryDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseCategoryDto | null>(null);

  const query = useQuery({
    queryKey: queryKeys.expenseCategories.list(list.params),
    queryFn: () => expenseCategoriesService.list(list.params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseCategoriesService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenseCategories.all,
      });
      setConfirmDelete(null);
      toast.success('Category deleted');
    },
  });

  const columns = useMemo<ColumnDef<ExpenseCategoryDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Category',
        meta: meta({ sortKey: 'name' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.name}</p>
            {row.original.description ? (
              <p className="truncate text-2xs text-muted-foreground">{row.original.description}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'sortOrder',
        header: 'Order',
        meta: meta({ sortKey: 'sortOrder', numeric: true, priority: 'low' }),
        cell: ({ row }) => <span className="text-xs">{row.original.sortOrder}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />,
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: meta({ cellClassName: 'w-10' }),
        cell: ({ row }) => {
          if (!can('expense_categories:update') && !can('expense_categories:delete')) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${row.original.name}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {can('expense_categories:update') ? (
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
                {can('expense_categories:delete') ? (
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
    [can],
  );

  return (
    <ResourceLayout
      title="Expense Categories"
      description="What money is spent on. Employees pick one for every expense."
      actions={
        can('expense_categories:create') ? (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add category
          </Button>
        ) : null
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
        emptyState={<EmptyState icon={Tags} title="No categories yet" />}
        toolbar={
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search categories…"
            className="w-full max-w-xs"
          />
        }
      />

      <CategoryFormModal open={formOpen} onOpenChange={setFormOpen} category={editing} />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name ?? 'this category'}?`}
        description="It disappears from the expense form. Past expenses keep their category."
        confirmLabel="Delete category"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
        }}
      />
    </ResourceLayout>
  );
};

export default ExpenseCategoriesPage;
