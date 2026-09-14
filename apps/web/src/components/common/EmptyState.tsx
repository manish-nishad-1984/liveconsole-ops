import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary call to action — usually "Add <record>". */
  action?: ReactNode;
  /** Secondary action, e.g. "Clear filters". */
  secondaryAction?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Shown when a list has no rows.
 *
 * The distinction that matters: "nothing exists yet" invites the user to create
 * the first record, while "your filters matched nothing" invites them to clear
 * the filters. Callers pick the right copy; this makes both look the same.
 */
export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 text-center',
      size === 'md' ? 'px-6 py-14' : 'px-4 py-8',
      className,
    )}
  >
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-accent text-accent-foreground',
        size === 'md' ? 'size-12' : 'size-10',
      )}
    >
      <Icon className={size === 'md' ? 'size-6' : 'size-5'} strokeWidth={1.75} />
    </div>

    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>

    {action || secondaryAction ? (
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {action}
        {secondaryAction}
      </div>
    ) : null}
  </div>
);
