import type { RoleDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type DataTableColumnMeta } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
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
import { RoleFormModal } from '@/pages/roles/RoleFormModal';
import { rolesService } from '@/services/roles.service';

/**
 * Roles.
 *
 * System roles show an Edit action (their permission sets stay editable) but no
 * Delete — the API refuses, and offering a button that always fails is worse than
 * not offering it.
 */

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const RolesListPage = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const list = useListQuery({ defaultSortBy: 'name', defaultSortDir: 'asc' });

  const [editing, setEditing] = useState<RoleDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RoleDto | null>(null);

  const query = useQuery({
    queryKey: queryKeys.roles.list(list.params),
    queryFn: () => rolesService.list(list.params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
      setConfirmDelete(null);
      toast.success('Role deleted');
    },
  });

  const columns = useMemo<ColumnDef<RoleDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Role',
        meta: meta({ sortKey: 'name' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-medium">
              {row.original.name}
              {row.original.isSystem ? <Badge variant="muted">System</Badge> : null}
            </p>
            <p className="truncate text-2xs text-muted-foreground">
              {row.original.description ?? row.original.slug}
            </p>
          </div>
        ),
      },
      {
        id: 'slug',
        header: 'Key',
        meta: meta({ sortKey: 'slug', priority: 'low' }),
        cell: ({ row }) => <code className="font-mono text-2xs">{row.original.slug}</code>,
      },
      {
        id: 'userCount',
        header: 'Users',
        meta: meta({ numeric: true }),
        cell: ({ row }) => row.original.userCount,
      },
      {
        id: 'permissionCount',
        header: 'Permissions',
        meta: meta({ numeric: true, priority: 'normal' }),
        cell: ({ row }) => row.original.permissionCount,
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: meta({ cellClassName: 'w-10' }),
        cell: ({ row }) => {
          const role = row.original;
          const canEdit = can('roles:update');
          const canDelete = can('roles:delete') && !role.isSystem;

          if (!canEdit && !canDelete) return null;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${role.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {canEdit ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(role);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil />
                    Edit permissions
                  </DropdownMenuItem>
                ) : null}

                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setConfirmDelete(role)}>
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
      title="Roles"
      description="Named permission sets. Users get their access from the roles assigned to them."
      actions={
        can('roles:create') ? (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add role
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
        onRowClick={
          can('roles:update')
            ? (role) => {
                setEditing(role);
                setFormOpen(true);
              }
            : undefined
        }
        emptyState={
          <EmptyState
            icon={ShieldCheck}
            title="No roles yet"
            description="Run the seed script to create the default roles, or add one here."
          />
        }
        toolbar={
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search roles…"
            className="w-full max-w-xs"
          />
        }
      />

      <RoleFormModal open={formOpen} onOpenChange={setFormOpen} role={editing} />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete the ${confirmDelete?.name ?? ''} role?`}
        description="Roles that are still assigned to somebody cannot be deleted — reassign those users first."
        confirmLabel="Delete role"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
        }}
      />
    </ResourceLayout>
  );
};

export default RolesListPage;
