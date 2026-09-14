import { zodResolver } from '@hookform/resolvers/zod';
import type { ExpenseCategoryDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type DataTableColumnMeta } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { FormGrid, FormModal } from '@/components/common/FormModal';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useListQuery } from '@/hooks/use-list-query';
import { usePermissions } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { expenseCategoriesService } from '@/services/masters.service';
import { applyFieldErrors } from '@/utils/errors';

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80),
  description: z.string().trim().max(300),
  sortOrder: z.coerce.number().int().min(0, 'Use 0 or more').max(100000),
  isActive: z.boolean(),
});

type CategoryForm = z.infer<typeof schema>;

const CategoryFormModal = ({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ExpenseCategoryDto | null;
}) => {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', sortOrder: 0, isActive: true },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: category?.name ?? '',
      description: category?.description ?? '',
      sortOrder: category?.sortOrder ?? 0,
      isActive: category?.isActive ?? true,
    });
    setFormError(null);
  }, [open, category, reset]);

  const mutation = useMutation({
    mutationFn: (values: CategoryForm) => {
      const payload = { ...values, description: values.description || null };
      return category
        ? expenseCategoriesService.update(category.id, payload)
        : expenseCategoriesService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenseCategories.all,
      });
      toast.success(category ? 'Category updated' : 'Category added');
      onOpenChange(false);
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['name', 'description', 'sortOrder'],
          fallback: 'Could not save this category.',
        }),
      ),
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={category ? `Edit ${category.name}` : 'Add a category'}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      submitLabel={category ? 'Save changes' : 'Add category'}
      isSubmitting={mutation.isPending}
      size="md"
    >
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <FormGrid>
        <FormField label="Name" error={errors.name?.message} required>
          {(props) => <Input {...props} {...register('name')} autoComplete="off" />}
        </FormField>
        <FormField label="Order" error={errors.sortOrder?.message} hint="Lower shows first.">
          {(props) => (
            <Input {...props} {...register('sortOrder')} type="number" inputMode="numeric" />
          )}
        </FormField>
        <FormField label="Description" error={errors.description?.message} full>
          {(props) => <Input {...props} {...register('description')} />}
        </FormField>
      </FormGrid>
      {category ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={watch('isActive')}
            onCheckedChange={(checked) => setValue('isActive', checked === true)}
          />
          Active — shown when adding expenses
        </label>
      ) : null}
    </FormModal>
  );
};

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
