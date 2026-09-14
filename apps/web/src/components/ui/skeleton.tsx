import type * as React from 'react';

import { cn } from '@/lib/utils';

/** Shimmering placeholder block. Composed by LoadingState into page skeletons. */
export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('relative overflow-hidden rounded-md bg-muted', className)}
    aria-hidden
    {...props}
  >
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-card/70 to-transparent" />
  </div>
);
