import { formatCurrency, formatNumber } from '@liveconsole-ops/shared';
import {
  RENTAL_STATUSES,
  RENT_PAYMENT_STATUSES,
  type VehicleRentalDto,
} from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, CheckCircle2, Download, Plus, Truck } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useListQuery } from '@/hooks/use-list-query';
import { useEmployeeOptions, useSiteOptions } from '@/hooks/use-options';
import { usePermissions } from '@/hooks/use-permissions';
import { ResourceLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { RentalDetailSheet } from '@/pages/vehicle-rentals/RentalDetailSheet';
import { RentalFormModal } from '@/pages/vehicle-rentals/RentalFormModal';
import {
  PAYMENT_STATUS_LABELS,
  RENTAL_STATUS_LABELS,
  paymentStatusTone,
} from '@/pages/vehicle-rentals/rent';
import { vehicleRentalsService } from '@/services/transport.service';
import { formatDateOnly } from '@/utils/dates';
import { runExport } from '@/utils/download';

/**
 * Vehicles hired for sites. The list answers "what is still owed, and to whom";
 * a row opens the rental with its payments.
 */

const meta = (value: DataTableColumnMeta): DataTableColumnMeta => value;

const ALL = 'ALL';

const VehicleRentalsPage = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const seeAll = can('transport:manage');
  const list = useListQuery({ defaultSortBy: 'fromDate', defaultSortDir: 'desc' });
  const [searchParams, setSearchParams] = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRentalDto | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VehicleRentalDto | null>(null);

  // `?new=1` opens the form; `?view=<id>` opens a rental (links from expenses).
  useEffect(() => {
    const view = searchParams.get('view');
    const isNew = searchParams.get('new') === '1';
    if (!view && !isNew) return;
    if (view) setViewingId(view);
    if (isNew) {
      setEditing(null);
      setFormOpen(true);
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('view');
        next.delete('new');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const employees = useEmployeeOptions(seeAll);
  const sites = useSiteOptions();

  const query = useQuery({
    queryKey: queryKeys.transport.list(list.params),
    queryFn: () => vehicleRentalsService.list(list.params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vehicleRentalsService.remove(id),
    onSuccess: (rental) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transport.all });
      setConfirmDelete(null);
      setViewingId(null);
      toast.success(`${rental.rentalNo} deleted`);
    },
  });

  const columns = useMemo<ColumnDef<VehicleRentalDto, unknown>[]>(
    () => [
      {
        id: 'vehicleType',
        header: 'Vehicle',
        meta: meta({ sortKey: 'vehicleType' }),
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate text-sm font-medium">
              {row.original.vehicleType}
              {row.original.vehicleNumber ? (
                <span className="numeric ml-1.5 text-xs text-muted-foreground">
                  {row.original.vehicleNumber}
                </span>
              ) : null}
            </p>
            <p className="truncate text-2xs text-muted-foreground">
              {row.original.vendorName}
              {row.original.site ? ` · ${row.original.site.name}` : ''}
            </p>
          </div>
        ),
      },
      ...(seeAll
        ? [
            {
              id: 'employee.fullName',
              header: 'In charge',
              meta: meta({ sortKey: 'employee.fullName', priority: 'normal' }),
              cell: ({ row }) => <span className="text-xs">{row.original.employee.fullName}</span>,
            } satisfies ColumnDef<VehicleRentalDto, unknown>,
          ]
        : []),
      {
        id: 'fromDate',
        header: 'Period',
        meta: meta({ sortKey: 'fromDate' }),
        cell: ({ row }) => (
          <div className="min-w-0 space-y-0.5">
            <p className="whitespace-nowrap text-xs">
              {formatDateOnly(row.original.fromDate)} –{' '}
              {row.original.toDate ? formatDateOnly(row.original.toDate) : '…'}
            </p>
            <div className="flex items-center gap-1.5">
              <StatusBadge
                status={row.original.rentalStatus}
                label={RENTAL_STATUS_LABELS[row.original.rentalStatus]}
              />
              <span className="text-2xs text-muted-foreground">{row.original.days}d</span>
            </div>
          </div>
        ),
      },
      {
        id: 'rentDue',
        header: 'Rent',
        meta: meta({ numeric: true, priority: 'normal' }),
        cell: ({ row }) => (
          <div className="text-right">
            <p className="numeric text-sm">{formatCurrency(row.original.rentDue)}</p>
            <p className="numeric text-2xs text-muted-foreground">
              {row.original.rentBasis === 'PER_DAY'
                ? `${formatCurrency(row.original.rate)}/day`
                : 'Fixed'}
            </p>
          </div>
        ),
      },
      {
        id: 'paidAmount',
        header: 'Paid',
        meta: meta({ numeric: true, priority: 'low' }),
        cell: ({ row }) => (
          <span className="numeric text-sm">{formatCurrency(row.original.paidAmount)}</span>
        ),
      },
      {
        id: 'pendingAmount',
        header: 'Due',
        meta: meta({ sortKey: 'pendingAmount', numeric: true }),
        cell: ({ row }) => {
          const due = Number(row.original.pendingAmount);
          return (
            <div className="space-y-0.5 text-right">
              <p
                className={cn(
                  'numeric text-sm font-semibold',
                  due > 0 ? 'text-status-danger' : 'text-muted-foreground',
                )}
              >
                {due < 0 ? `+${formatCurrency(-due)}` : formatCurrency(due)}
              </p>
              <StatusBadge
                status={row.original.paymentStatus}
                label={due < 0 ? 'Advance' : PAYMENT_STATUS_LABELS[row.original.paymentStatus]}
                tone={paymentStatusTone(row.original.paymentStatus)}
              />
            </div>
          );
        },
      },
    ],
    [seeAll],
  );

  const summary = query.data?.summary;
  const paymentFilter = list.filters.paymentStatus;

  return (
    <ResourceLayout
      title="Vehicle Rentals"
      description={
        seeAll
          ? 'Vehicles hired for sites — rent, payments and what is still owed.'
          : 'Vehicles you have hired for site work, and the rent paid for them.'
      }
      actions={
        <>
          {can('transport:export') ? (
            <Button
              variant="outline"
              onClick={() =>
                void runExport(
                  () => vehicleRentalsService.exportCsv(list.params),
                  'vehicle-rentals.csv',
                )
              }
            >
              <Download />
              Export
            </Button>
          ) : null}
          {can('transport:create') ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Add vehicle
            </Button>
          ) : null}
        </>
      }
      summary={
        /* Three figures, the ones asked of this screen: how many vehicles are out,
           what has been paid for them, and what is still owed. The rent the paid
           figure is measured against rides along as its hint rather than taking a
           tile of its own. */
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={Truck}
            label="Vehicles on rent"
            value={formatNumber(summary?.onRent ?? 0)}
            hint={`${formatNumber(summary?.count ?? 0)} rentals in this list`}
            active={list.filters.rentalStatus === 'ON_RENT'}
            onClick={() =>
              list.setFilter(
                'rentalStatus',
                list.filters.rentalStatus === 'ON_RENT' ? null : 'ON_RENT',
              )
            }
          />
          <StatTile
            icon={CheckCircle2}
            tone="success"
            label="Total rent paid"
            value={formatCurrency(summary?.paid ?? 0)}
            hint={`of ${formatCurrency(summary?.rentDue ?? 0)} rent${
              list.hasActiveFilters ? ' (filtered)' : ''
            }`}
          />
          <StatTile
            icon={AlertCircle}
            tone="danger"
            label="Total pending rent"
            value={formatCurrency(summary?.pending ?? 0)}
            hint="Tap to see unpaid"
            active={paymentFilter === 'PENDING'}
            onClick={() =>
              list.setFilter('paymentStatus', paymentFilter === 'PENDING' ? null : 'PENDING')
            }
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
        onRowClick={(rental) => setViewingId(rental.id)}
        hasActiveFilters={list.hasActiveFilters}
        emptyState={
          <EmptyState
            icon={Truck}
            title="No vehicles yet"
            description='Record a vehicle taken on rent with "Add vehicle", then add payments to it.'
          />
        }
        toolbar={
          <>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search vehicle, number, owner, driver…"
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
            <Select
              value={list.filters.rentalStatus ?? ALL}
              onValueChange={(value) =>
                list.setFilter('rentalStatus', value === ALL ? null : value)
              }
            >
              <SelectTrigger className="h-9 w-36" aria-label="Filter by rental status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any status</SelectItem>
                {RENTAL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {RENTAL_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={paymentFilter ?? ALL}
              onValueChange={(value) =>
                list.setFilter('paymentStatus', value === ALL ? null : value)
              }
            >
              <SelectTrigger className="h-9 w-36" aria-label="Filter by payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Paid & unpaid</SelectItem>
                {RENT_PAYMENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {PAYMENT_STATUS_LABELS[status]}
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

      <RentalDetailSheet
        rentalId={viewingId}
        onOpenChange={(open) => !open && setViewingId(null)}
        onEdit={(rental) => {
          setViewingId(null);
          setEditing(rental);
          setFormOpen(true);
        }}
        onDelete={(rental) => setConfirmDelete(rental)}
      />

      <RentalFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        rental={editing}
        onSaved={(rental) => {
          // A new vehicle usually gets its first payment straight away.
          if (!editing) setViewingId(rental.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.rentalNo ?? 'this rental'}?`}
        description={
          confirmDelete
            ? confirmDelete.paymentCount > 0
              ? 'It has payments recorded. Delete those from the rental first.'
              : `${confirmDelete.vehicleType} from ${confirmDelete.vendorName}.`
            : undefined
        }
        confirmLabel="Delete rental"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
        }}
      />
    </ResourceLayout>
  );
};

export default VehicleRentalsPage;
