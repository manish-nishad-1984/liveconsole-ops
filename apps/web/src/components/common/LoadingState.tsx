import { Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Loading placeholders.
 *
 * Skeletons that match the shape of the eventual content are preferred over a
 * spinner: the layout does not jump when data lands, which matters most on dense
 * table screens.
 */

export const TableSkeleton = ({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) => (
  <div className="w-full" aria-busy aria-label="Loading records">
    <div className="flex gap-3 border-b border-border bg-muted/50 px-3 py-2.5">
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} className="h-3 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex items-center gap-3 border-b border-border/60 px-3 py-3">
        {Array.from({ length: columns }).map((_, columnIndex) => (
          <Skeleton
            key={columnIndex}
            className={cn('h-3.5 flex-1', columnIndex === 0 && 'max-w-[22%]')}
          />
        ))}
      </div>
    ))}
  </div>
);

export const CardGridSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
    {Array.from({ length: count }).map((_, index) => (
      <Card key={index}>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export const DetailSkeleton = () => (
  <div className="space-y-4" aria-busy>
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3.5 w-36" />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);

export interface LoadingStateProps {
  variant?: 'table' | 'cards' | 'detail' | 'inline' | 'page';
  rows?: number;
  columns?: number;
  label?: string;
  className?: string;
}

export const LoadingState = ({
  variant = 'table',
  rows,
  columns,
  label = 'Loading…',
  className,
}: LoadingStateProps) => {
  if (variant === 'table') return <TableSkeleton rows={rows} columns={columns} />;
  if (variant === 'cards') return <CardGridSkeleton count={rows} />;
  if (variant === 'detail') return <DetailSkeleton />;

  if (variant === 'page') {
    return (
      <div
        className={cn('flex min-h-[60vh] flex-col items-center justify-center gap-3', className)}
      >
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <Loader2 className="size-3.5 animate-spin" />
      {label}
    </div>
  );
};
