import { PAGE_SIZE_OPTIONS, formatNumber } from '@liveconsole-ops/shared';
import type { PaginationMeta } from '@liveconsole-ops/types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showPageSize?: boolean;
  className?: string;
}

/**
 * Build a compact page list with ellipses: `1 … 6 7 [8] 9 10 … 42`.
 * Always shows the first and last page so jumping to either is one click.
 */
const buildPageList = (current: number, total: number): (number | 'gap')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current]);
  for (const offset of [-1, 1]) {
    const page = current + offset;
    if (page > 1 && page < total) pages.add(page);
  }
  // Pad the ends so the control does not change width as the user pages through.
  if (current <= 3) [2, 3, 4].forEach((page) => page < total && pages.add(page));
  if (current >= total - 2)
    [total - 1, total - 2, total - 3].forEach((page) => page > 1 && pages.add(page));

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];

  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) result.push('gap');
    result.push(page);
  });

  return result;
};

export const Pagination = ({
  pagination,
  onPageChange,
  onPageSizeChange,
  showPageSize = true,
  className,
}: PaginationProps) => {
  const { page, pageSize, total, totalPages, hasNext, hasPrev } = pagination;

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 border-t border-border px-3 py-2.5 sm:flex-row',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {total === 0 ? (
            'No records'
          ) : (
            <>
              <span className="font-medium text-foreground">
                {formatNumber(firstRow)}–{formatNumber(lastRow)}
              </span>{' '}
              of {formatNumber(total)}
            </>
          )}
        </p>

        {showPageSize && onPageSizeChange ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="text-xs text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(next) => onPageSizeChange(Number(next))}
            >
              <SelectTrigger className="h-7 w-[4.5rem] text-xs" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasPrev}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasPrev}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>

          <div className="hidden items-center gap-1 sm:flex">
            {buildPageList(page, totalPages).map((entry, index) =>
              entry === 'gap' ? (
                <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={entry}
                  variant={entry === page ? 'default' : 'ghost'}
                  size="icon-sm"
                  onClick={() => onPageChange(entry)}
                  aria-label={`Page ${entry}`}
                  aria-current={entry === page ? 'page' : undefined}
                  className="text-xs"
                >
                  {entry}
                </Button>
              ),
            )}
          </div>

          <span className="px-1 text-xs text-muted-foreground sm:hidden">
            {page} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasNext}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            <ChevronsRight />
          </Button>
        </nav>
      ) : null}
    </div>
  );
};
