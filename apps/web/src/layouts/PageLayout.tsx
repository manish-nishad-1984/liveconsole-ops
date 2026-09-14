import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { cn } from '@/lib/utils';

/**
 * Page shells.
 *
 * Every screen in the application is one of these three shapes, and none of them
 * knows what it is displaying. A module supplies a title and its content; the
 * spacing, the header, the toolbar position and the tab strip are decided once,
 * here, so thirty modules cannot each arrive at a slightly different page.
 */

export interface TabDefinition {
  key: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

export interface PageLayoutProps {
  title: string;
  description?: string;
  /** Right-aligned page actions — usually one primary button and an overflow menu. */
  actions?: ReactNode;
  /** Status badges or record metadata beside the title. */
  meta?: ReactNode;
  tabs?: TabDefinition[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  children: ReactNode;
  className?: string;
}

const TabStrip = ({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: TabDefinition[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
}) => (
  <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
    {tabs.map((tab) => {
      const Icon = tab.icon;
      const isActive = tab.key === activeTab;

      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={isActive}
          disabled={tab.disabled}
          onClick={() => onTabChange?.(tab.key)}
          className={cn(
            'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            'disabled:pointer-events-none disabled:opacity-50',
            isActive
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
          )}
        >
          {Icon ? <Icon className="size-4" aria-hidden /> : null}
          {tab.label}
          {tab.count !== undefined ? (
            <span
              className={cn(
                'numeric rounded-full px-1.5 py-0.5 text-2xs',
                isActive ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);

/** The general page: header, optional tabs, free-form content. */
export const PageLayout = ({
  title,
  description,
  actions,
  meta,
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}: PageLayoutProps) => {
  useDocumentTitle(title);

  return (
    <div className={cn('space-y-5', className)}>
      <PageHeader title={title} description={description} actions={actions} meta={meta}>
        {tabs?.length ? (
          <TabStrip tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        ) : null}
      </PageHeader>

      {children}
    </div>
  );
};

export interface ResourceLayoutProps extends PageLayoutProps {
  /** Summary tiles above the table, e.g. counts by status. */
  summary?: ReactNode;
}

/**
 * The list screen: header, summary tiles, then the table.
 *
 * `DataTable` already draws its own card, toolbar row and pagination footer, so
 * this only supplies the surrounding structure — two nested cards would read as
 * unrelated panels.
 */
export const ResourceLayout = ({ summary, children, ...pageProps }: ResourceLayoutProps) => (
  <PageLayout {...pageProps}>
    {summary}
    {children}
  </PageLayout>
);

export interface DetailLayoutProps extends PageLayoutProps {
  /** The right-hand column — status, assignment, related records. */
  aside?: ReactNode;
}

/**
 * The record screen: a wide main column with a narrow sidebar that collapses
 * underneath it below `xl`.
 */
export const DetailLayout = ({ aside, children, ...pageProps }: DetailLayoutProps) => (
  <PageLayout {...pageProps}>
    <div className={cn('grid gap-5', aside && 'xl:grid-cols-[minmax(0,1fr)_20rem]')}>
      <div className="min-w-0 space-y-5">{children}</div>
      {aside ? <div className="space-y-5">{aside}</div> : null}
    </div>
  </PageLayout>
);

/** A labelled block inside a detail page. */
export const SectionCard = ({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <Card className={className}>
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
    <div className="p-4">{children}</div>
  </Card>
);
