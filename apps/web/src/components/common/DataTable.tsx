import type { PaginationMeta, SortDirection } from '@liveconsole-ops/types';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { TableSkeleton } from '@/components/common/LoadingState';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUiStore } from '@/store/ui.store';
import { cn } from '@/lib/utils';

/**
 * The table every module list uses.
 *
 * Sorting and pagination are *server-side* (`manual*` on the TanStack instance) —
 * a real list is thousands of rows and must never be fetched whole to sort a
 * column. The component therefore owns no data fetching itself: the caller passes
 * `data`, `pagination` and the callbacks, which keeps it usable with any query.
 */

export interface DataTableColumnMeta {
  /** Right-aligns and applies tabular figures — use for money and quantities. */
  numeric?: boolean;
  /** Columns marked `low`/`normal` collapse away on small screens. */
  priority?: 'high' | 'normal' | 'low';
  /** Server-side sort key. Omit to make the column unsortable. */
  sortKey?: string;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];

  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;

  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;

  sortBy?: string;
  sortDir?: SortDirection;
  onSortChange?: (sortKey: string) => void;

  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  rowClassName?: (row: TData) => string | undefined;

  emptyState?: ReactNode;
  /** Shown instead of `emptyState` when filters are active. */
  emptyFilteredState?: ReactNode;
  hasActiveFilters?: boolean;

  enableColumnVisibility?: boolean;
  /** Rendered to the left of the column-visibility control. */
  toolbar?: ReactNode;
  className?: string;
}

export const DataTable = <TData,>({
  data,
  columns,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
  pagination,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortDir,
  onSortChange,
  onRowClick,
  getRowId,
  rowClassName,
  emptyState,
  emptyFilteredState,
  hasActiveFilters = false,
  enableColumnVisibility = true,
  toolbar,
  className,
}: DataTableProps<TData>) => {
  const density = useUiStore((state) => state.density);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const cellPadding = density === 'compact' ? 'py-2' : 'py-3';

  const renderBody = () => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={columns.length} className="!border-0 !p-0">
            <TableSkeleton columns={Math.min(columns.length, 7)} />
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td colSpan={columns.length} className="!border-0">
            <ErrorState error={error} onRetry={onRetry} />
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="!border-0">
            {hasActiveFilters
              ? (emptyFilteredState ?? (
                  <EmptyState
                    title="No records match these filters"
                    description="Try a different search term or clear a filter."
                  />
                ))
              : (emptyState ?? <EmptyState title="Nothing here yet" />)}
          </td>
        </tr>
      );
    }

    return table.getRowModel().rows.map((row: Row<TData>) => (
      <tr
        key={row.id}
        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
        className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row.original))}
      >
        {row.getVisibleCells().map((cell) => {
          const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;
          return (
            <td
              key={cell.id}
              className={cn(
                cellPadding,
                meta?.numeric && 'numeric text-right',
                meta?.priority === 'low' && 'hidden xl:table-cell',
                meta?.priority === 'normal' && 'hidden md:table-cell',
                meta?.cellClassName,
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
    ));
  };

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-border bg-card',
        className,
      )}
    >
      {toolbar || enableColumnVisibility ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>

          {enableColumnVisibility ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Columns3 />
                  <span className="hidden sm:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(value)}
                      onSelect={(event) => event.preventDefault()}
                    >
                      {typeof column.columnDef.header === 'string'
                        ? column.columnDef.header
                        : column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'relative overflow-x-auto',
          isFetching && !isLoading && 'opacity-70 transition-opacity',
        )}
      >
        <table className="erp-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
                  const sortKey = meta?.sortKey;
                  const isSorted = sortKey !== undefined && sortBy === sortKey;

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        meta?.numeric && 'text-right',
                        meta?.priority === 'low' && 'hidden xl:table-cell',
                        meta?.priority === 'normal' && 'hidden md:table-cell',
                        meta?.headerClassName,
                      )}
                      aria-sort={
                        isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                    >
                      {header.isPlaceholder ? null : sortKey && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => onSortChange(sortKey)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded transition-colors hover:text-foreground',
                            meta?.numeric && 'flex-row-reverse',
                            isSorted && 'text-foreground',
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>{renderBody()}</tbody>
        </table>
      </div>

      {pagination && onPageChange && !error ? (
        <Pagination
          pagination={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </div>
  );
};
