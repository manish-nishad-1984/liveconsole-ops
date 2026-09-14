import { zodResolver } from '@hookform/resolvers/zod';
import type { SiteDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { MapPin, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useListQuery } from '@/hooks/use-list-query';
import { usePermissions } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { sitesService } from '@/services/masters.service';
import { applyFieldErrors } from '@/utils/errors';

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the site name').max(120),
  location: z.string().trim().max(180),
  clientName: z.string().trim().max(120),
  notes: z.string().trim().max(1000),
  isActive: z.boolean(),
});

type SiteForm = z.infer<typeof schema>;

const SiteFormModal = ({
  open,
  onOpenChange,
  site,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: SiteDto | null;
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
  } = useForm<SiteForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      location: '',
      clientName: '',
      notes: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: site?.name ?? '',
      location: site?.location ?? '',
      clientName: site?.clientName ?? '',
      notes: site?.notes ?? '',
      isActive: site?.isActive ?? true,
    });
    setFormError(null);
  }, [open, site, reset]);

  const mutation = useMutation({
    mutationFn: (values: SiteForm) => {
      const payload = {
        name: values.name,
        location: values.location || null,
        clientName: values.clientName || null,
        notes: values.notes || null,
        isActive: values.isActive,
      };
      return site ? sitesService.update(site.id, payload) : sitesService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
      toast.success(site ? 'Site updated' : 'Site added');
      onOpenChange(false);
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['name', 'location', 'clientName', 'notes'],
          fallback: 'Could not save this site.',
        }),
      ),
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={site ? `Edit ${site.name}` : 'Add a site'}
      description="Expenses and vehicles are booked against sites."
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      submitLabel={site ? 'Save changes' : 'Add site'}
      isSubmitting={mutation.isPending}
      size="md"
    >
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <FormGrid>
        <FormField label="Site name" error={errors.name?.message} required full>
          {(props) => <Input {...props} {...register('name')} autoComplete="off" />}
        </FormField>
        <FormField label="Location" error={errors.location?.message}>
          {(props) => <Input {...props} {...register('location')} placeholder="City / area" />}
        </FormField>
        <FormField label="Client" error={errors.clientName?.message}>
          {(props) => <Input {...props} {...register('clientName')} />}
        </FormField>
        <FormField label="Notes" error={errors.notes?.message} full>
          {(props) => <Textarea {...props} {...register('notes')} rows={2} />}
        </FormField>
      </FormGrid>
      {site ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={watch('isActive')}
            onCheckedChange={(checked) => setValue('isActive', checked === true)}
          />
          Active — shown in pickers
        </label>
      ) : null}
    </FormModal>
  );
};

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

const SitesListPage = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const list = useListQuery({ defaultSortBy: 'name', defaultSortDir: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SiteDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SiteDto | null>(null);

  const query = useQuery({
    queryKey: queryKeys.sites.list(list.params),
    queryFn: () => sitesService.list(list.params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sitesService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
      setConfirmDelete(null);
      toast.success('Site deleted');
    },
  });

  const columns = useMemo<ColumnDef<SiteDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Site',
        meta: meta({ sortKey: 'name' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.name}</p>
            {row.original.notes ? (
              <p className="truncate text-2xs text-muted-foreground">{row.original.notes}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'location',
        header: 'Location',
        meta: meta({ sortKey: 'location', priority: 'normal' }),
        cell: ({ row }) => <span className="text-xs">{row.original.location ?? '—'}</span>,
      },
      {
        id: 'clientName',
        header: 'Client',
        meta: meta({ sortKey: 'clientName', priority: 'low' }),
        cell: ({ row }) => <span className="text-xs">{row.original.clientName ?? '—'}</span>,
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
          if (!can('sites:update') && !can('sites:delete')) return null;
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
                {can('sites:update') ? (
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
                {can('sites:delete') ? (
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
      title="Sites"
      description="Work sites that expenses and vehicles are booked against."
      actions={
        can('sites:create') ? (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add site
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
        emptyState={
          <EmptyState
            icon={MapPin}
            title="No sites yet"
            description="Add the sites your team works at, so expenses can be booked against them."
          />
        }
        toolbar={
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search site, location, client…"
            className="w-full max-w-xs"
          />
        }
      />

      <SiteFormModal open={formOpen} onOpenChange={setFormOpen} site={editing} />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name ?? 'this site'}?`}
        description="It disappears from pickers. Expenses already booked against it keep showing its name."
        confirmLabel="Delete site"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
        }}
      />
    </ResourceLayout>
  );
};

export default SitesListPage;
