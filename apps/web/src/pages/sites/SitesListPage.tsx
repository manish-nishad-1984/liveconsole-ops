import type { SiteDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { MapPin, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { SiteFormModal } from '@/pages/sites/SiteFormModal';
import { sitesService } from '@/services/masters.service';

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

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
