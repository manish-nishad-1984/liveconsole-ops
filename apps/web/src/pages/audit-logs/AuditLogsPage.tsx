import { formatDateTime, humanizeEnum } from '@liveconsole-ops/shared';
import type { AuditLogDto } from '@liveconsole-ops/types';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { History } from 'lucide-react';
import { useMemo } from 'react';

import { DataTable, type DataTableColumnMeta } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useListQuery } from '@/hooks/use-list-query';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { auditService } from '@/services/audit.service';

/**
 * Who did what, when.
 *
 * Read-only by construction — there is no write path to this table outside
 * `services/audit.service.ts` on the API, and no mutation here at all. A trail
 * somebody can edit is not a trail.
 */

const ALL = '__all__';

const ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'PERMISSION_CHANGE',
  'STATUS_CHANGE',
  'EXPORT',
  'IMPORT',
];

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const AuditLogsPage = () => {
  const list = useListQuery({ defaultSortBy: 'createdAt', defaultSortDir: 'desc' });

  const query = useQuery({
    queryKey: queryKeys.auditLogs.list(list.params),
    queryFn: () => auditService.list(list.params),
  });

  const entityTypes = useQuery({
    queryKey: queryKeys.auditLogs.entityTypes,
    queryFn: () => auditService.entityTypes(),
  });

  const columns = useMemo<ColumnDef<AuditLogDto, unknown>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'When',
        meta: meta({ sortKey: 'createdAt' }),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        meta: meta({ sortKey: 'action' }),
        cell: ({ row }) => <StatusBadge status={row.original.action} withDot={false} />,
      },
      {
        id: 'entity',
        header: 'Record',
        meta: meta({ sortKey: 'entityType' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{row.original.entityType}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {row.original.entityLabel ?? row.original.entityId ?? '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'actor',
        header: 'By',
        meta: meta({ priority: 'normal' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-xs">{row.original.actorName ?? 'System'}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {row.original.actorEmail ?? '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'changedFields',
        header: 'Changed',
        meta: meta({ priority: 'low' }),
        cell: ({ row }) =>
          row.original.changedFields.length > 0 ? (
            <span className="text-2xs text-muted-foreground">
              {row.original.changedFields.join(', ')}
            </span>
          ) : (
            <span className="text-2xs text-muted-foreground/60">—</span>
          ),
      },
      {
        id: 'ipAddress',
        header: 'IP',
        meta: meta({ priority: 'low' }),
        cell: ({ row }) => (
          <span className="numeric text-2xs text-muted-foreground">
            {row.original.ipAddress ?? '—'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <ResourceLayout title="Audit log" description="Every change, and who made it.">
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
            icon={History}
            title="Nothing logged yet"
            description="Entries appear here as soon as anyone signs in or changes a record."
          />
        }
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search record or actor…"
              className="w-full max-w-xs"
            />

            <Select
              value={list.filters.action ?? ALL}
              onValueChange={(value) => list.setFilter('action', value === ALL ? null : value)}
            >
              <SelectTrigger className="h-9 w-44" aria-label="Filter by action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {ACTIONS.map((action) => (
                  <SelectItem key={action} value={action}>
                    {humanizeEnum(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={list.filters.entityType ?? ALL}
              onValueChange={(value) => list.setFilter('entityType', value === ALL ? null : value)}
            >
              <SelectTrigger className="h-9 w-40" aria-label="Filter by record type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All records</SelectItem>
                {(entityTypes.data ?? []).map((entityType) => (
                  <SelectItem key={entityType} value={entityType}>
                    {entityType}
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
    </ResourceLayout>
  );
};

export default AuditLogsPage;
