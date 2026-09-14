import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary and secondary buttons, right-aligned. */
  actions?: ReactNode;
  /** Status badges or record metadata shown beside the title. */
  meta?: ReactNode;
  /** Tabs or a summary strip rendered under the header. */
  children?: ReactNode;
  className?: string;
}

/**
 * The header every page starts with. It owns the page title and the action area,
 * so those never drift out of alignment between modules.
 */
export const PageHeader = ({
  title,
  description,
  actions,
  meta,
  children,
  className,
}: PageHeaderProps) => (
  <header className={cn('space-y-3', className)}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
          {meta}
        </div>
        {description ? (
          <p className="max-w-3xl text-xs text-muted-foreground sm:text-sm">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>

    {children}
  </header>
);
