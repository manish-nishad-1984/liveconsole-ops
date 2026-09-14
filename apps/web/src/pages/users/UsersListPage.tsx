import { formatDateTime } from '@liveconsole-ops/shared';
import type { UserDto, UserStatus } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Ban,
  Copy,
  Download,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type DataTableColumnMeta } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
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
import { usePermissions } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { UserFormModal } from '@/pages/users/UserFormModal';
import { usersService } from '@/services/users.service';
import { getErrorMessage } from '@/utils/errors';

/**
 * Who has access.
 *
 * Every action is gated on the matching `users:*` permission and *hidden* rather
 * than disabled when the viewer lacks it — a button whose only outcome is a 403
 * teaches people that the app is unreliable.
 */

const STATUS_FILTER = ['ALL', 'ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED'] as const;

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const UsersListPage = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const list = useListQuery({ defaultSortBy: 'fullName', defaultSortDir: 'asc' });

  const [editing, setEditing] = useState<UserDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserDto | null>(null);
  const [confirmReset, setConfirmReset] = useState<UserDto | null>(null);
  /** Shown once, right after a temporary password is generated. */
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null);

  const query = useQuery({
    queryKey: queryKeys.users.list(list.params),
    queryFn: () => usersService.list(list.params),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      usersService.setStatus(id, status),
    onSuccess: (user) => {
      void invalidate();
      toast.success(`${user.fullName} is now ${user.status.toLowerCase()}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.remove(id),
    onSuccess: () => {
      void invalidate();
      setConfirmDelete(null);
      toast.success('User deleted');
    },
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => usersService.setPassword(id, { mustChangePassword: true }),
    onSuccess: (result) => {
      void invalidate();
      const email = confirmReset?.phone ?? confirmReset?.email ?? '';
      setConfirmReset(null);
      if (result.temporaryPassword) {
        setRevealed({ email, password: result.temporaryPassword });
      }
    },
  });

  const exportCsv = async () => {
    try {
      const { blob, fileName } = await usersService.exportCsv(list.params);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName ?? 'users.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Export failed', { description: getErrorMessage(error) });
    }
  };

  const columns = useMemo<ColumnDef<UserDto, unknown>[]>(
    () => [
      {
        id: 'fullName',
        header: 'Name',
        meta: meta({ sortKey: 'fullName' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.fullName}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {row.original.designation ?? row.original.employeeCode ?? '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'email',
        header: 'Contact',
        meta: meta({ sortKey: 'email' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-xs">{row.original.phone ?? '—'}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {row.original.email ?? 'No email'}
            </p>
          </div>
        ),
      },
      {
        id: 'roles',
        header: 'Roles',
        meta: meta({ priority: 'normal' }),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.isSuperAdmin ? <Badge variant="default">Super admin</Badge> : null}
            {row.original.roles.map((role) => (
              <Badge key={role.id} variant="outline">
                {role.name}
              </Badge>
            ))}
            {row.original.roles.length === 0 && !row.original.isSuperAdmin ? (
              <span className="text-2xs text-muted-foreground">No role</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        meta: meta({ sortKey: 'status' }),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'lastLoginAt',
        header: 'Last sign-in',
        meta: meta({ sortKey: 'lastLoginAt', priority: 'low' }),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(row.original.lastLoginAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: meta({ cellClassName: 'w-10' }),
        cell: ({ row }) => {
          const user = row.original;
          const canEdit = can('users:update');
          const canManage = can('users:manage');
          const canDelete = can('users:delete');

          if (!canEdit && !canManage && !canDelete) return null;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.fullName}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {canEdit ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(user);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                ) : null}

                {canManage ? (
                  <DropdownMenuItem onSelect={() => setConfirmReset(user)}>
                    <KeyRound />
                    Reset password
                  </DropdownMenuItem>
                ) : null}

                {canEdit ? (
                  user.status === 'SUSPENDED' || user.status === 'DISABLED' ? (
                    <DropdownMenuItem
                      onSelect={() => statusMutation.mutate({ id: user.id, status: 'ACTIVE' })}
                    >
                      <UserCheck />
                      Reactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() => statusMutation.mutate({ id: user.id, status: 'SUSPENDED' })}
                    >
                      <Ban />
                      Suspend
                    </DropdownMenuItem>
                  )
                ) : null}

                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setConfirmDelete(user)}>
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
    [can, statusMutation],
  );

  const statusFilter = list.filters.status ?? 'ALL';

  return (
    <ResourceLayout
      title="Users"
      description="People with access to this workspace."
      actions={
        <>
          {can('users:export') ? (
            <Button variant="outline" onClick={() => void exportCsv()}>
              <Download />
              Export
            </Button>
          ) : null}
          {can('users:create') ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <UserPlus />
              Add user
            </Button>
          ) : null}
        </>
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
            title="No users yet"
            description="Everyone who signs in needs an account here."
          />
        }
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search name, mobile, email…"
              className="w-full max-w-xs"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => list.setFilter('status', value === 'ALL' ? null : value)}
            >
              <SelectTrigger className="h-9 w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'ALL' ? 'All statuses' : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {list.hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={list.clearFilters}>
                Clear
              </Button>
            ) : null}
          </>
        }
      />

      <UserFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        onCreatedWithTemporaryPassword={(email, password) => setRevealed({ email, password })}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.fullName ?? 'this user'}?`}
        description="The account is disabled and signed out everywhere. Its audit history is kept."
        confirmLabel="Delete user"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmReset)}
        onOpenChange={(open) => !open && setConfirmReset(null)}
        variant="warning"
        title={`Reset the password for ${confirmReset?.fullName ?? 'this user'}?`}
        description="A temporary password is generated and shown once. The user is signed out of every device and must set a new password on their next sign-in."
        confirmLabel="Reset password"
        loading={resetMutation.isPending}
        onConfirm={() => {
          if (confirmReset) resetMutation.mutate(confirmReset.id);
        }}
      />

      {/*
       * The one place a password is ever displayed. It is not stored in plaintext
       * anywhere and cannot be retrieved again, so the dialog says so plainly.
       */}
      <ConfirmDialog
        open={Boolean(revealed)}
        onOpenChange={(open) => !open && setRevealed(null)}
        variant="info"
        title="Temporary password"
        description={`Give this to ${revealed?.email ?? 'the user'}. It is shown once and cannot be retrieved again.`}
        confirmLabel="Done"
        cancelLabel="Close"
        onConfirm={() => setRevealed(null)}
      >
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <code className="flex-1 truncate font-mono text-sm">{revealed?.password}</code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Copy password"
            onClick={() => {
              if (!revealed) return;
              void navigator.clipboard.writeText(revealed.password);
              toast.success('Copied to clipboard');
            }}
          >
            <Copy />
          </Button>
        </div>
      </ConfirmDialog>
    </ResourceLayout>
  );
};

export default UsersListPage;
