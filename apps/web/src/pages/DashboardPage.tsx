import { formatDateTime, formatNumber, formatRelative } from '@liveconsole-ops/shared';
import { useQuery } from '@tanstack/react-query';
import { Activity, ShieldCheck, UserPlus, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Card, CardContent } from '@/components/ui/card';
import { PageLayout, SectionCard } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { dashboardService } from '@/services/dashboard.service';
import { useAuthStore } from '@/store/auth.store';

/**
 * The starter dashboard.
 *
 * Reports on the only thing a boilerplate actually knows about — who has access.
 * It exists to demonstrate the full module wiring end to end (registry entry →
 * generated route → guard → query key → service → API route → permission), not
 * because these four numbers are interesting. Replace it with your own.
 */

const Tile = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) => (
  <Card>
    <CardContent className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-semibold leading-tight">{value}</p>
        {hint ? <p className="truncate text-2xs text-muted-foreground">{hint}</p> : null}
      </div>
    </CardContent>
  </Card>
);

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: () => dashboardService.summary(),
  });

  return (
    <PageLayout
      title={`Welcome back, ${user?.fullName.split(' ')[0] ?? 'there'}`}
      description="A starting point. Replace this screen with your own once the first real module exists."
    >
      {isLoading ? (
        <LoadingState variant="cards" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              icon={Users}
              label="Users"
              value={formatNumber(data.users.total)}
              hint={`${formatNumber(data.users.active)} active`}
            />
            <Tile
              icon={UserPlus}
              label="Invited"
              value={formatNumber(data.users.invited)}
              hint="Have not signed in yet"
            />
            <Tile
              icon={ShieldCheck}
              label="Roles"
              value={formatNumber(data.roles.total)}
              hint={`${formatNumber(data.roles.custom)} custom`}
            />
            <Tile
              icon={Activity}
              label="Activity (24h)"
              value={formatNumber(data.activity.last24h)}
              hint={
                data.activity.lastSignInAt
                  ? `last sign-in ${formatRelative(data.activity.lastSignInAt)}`
                  : 'no sign-ins recorded'
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Organisation" description="The tenant this session belongs to.">
              <dl className="space-y-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="text-right font-medium">{data.organization?.name ?? '—'}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Code</dt>
                  <dd className="numeric text-right">{data.organization?.code ?? '—'}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="text-right">{formatDateTime(data.organization?.createdAt)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Suspended accounts</dt>
                  <dd className="numeric text-right">{formatNumber(data.users.suspended)}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard
              title="Adding your first module"
              description="Five steps, and none of them touch auth, theming or the router."
            >
              <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground">
                <li>
                  Add its actions to <code className="font-mono">MODULE_PERMISSIONS</code> in{' '}
                  <code className="font-mono">packages/types/src/rbac.ts</code>.
                </li>
                <li>
                  Add its entry to <code className="font-mono">MODULES</code> in{' '}
                  <code className="font-mono">packages/shared/src/modules.ts</code>.
                </li>
                <li>
                  Grant it in <code className="font-mono">ROLE_SEEDS</code> and re-run{' '}
                  <code className="font-mono">npm run db:seed</code>.
                </li>
                <li>
                  Build the five API files and register the router in{' '}
                  <code className="font-mono">apps/api/src/routes/index.ts</code>.
                </li>
                <li>
                  Add the page to <code className="font-mono">MODULE_PAGES</code> in{' '}
                  <code className="font-mono">apps/web/src/routes/module-routes.tsx</code>.
                </li>
              </ol>
            </SectionCard>
          </div>
        </>
      ) : null}
    </PageLayout>
  );
};

export default DashboardPage;
