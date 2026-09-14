import { RefreshCw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/utils/errors';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Shown in place of content a query could not load.
 *
 * A retry button is not decoration: most failures here are transient (a dropped
 * connection, a restarted API), and without one the only recovery a user knows is
 * a full page reload.
 */
export const ErrorState = ({
  error,
  title = 'Could not load this',
  onRetry,
  className,
}: ErrorStateProps) => (
  <div
    role="alert"
    className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
  >
    <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
      <TriangleAlert className="size-6" strokeWidth={1.75} />
    </div>

    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
        {getErrorMessage(error)}
      </p>
    </div>

    {onRetry ? (
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    ) : null}
  </div>
);
