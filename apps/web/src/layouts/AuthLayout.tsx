import { APP_NAME } from '@liveconsole-ops/shared';
import { Building2, LayoutGrid, ShieldCheck, SquareStack } from 'lucide-react';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';

/**
 * Shell for the unauthenticated screens (sign in, forgot password, reset).
 *
 * Split layout: the form on the left keeps focus where the work is, and the
 * right-hand panel — hidden below `lg` — carries the identity without competing
 * with it. No background image: the panel is a flat `bg-primary` fill, two blurred
 * circles and an icon-in-tinted-square feature list, so it never needs an asset
 * and never fights the form for attention.
 */

const TAGLINE = 'Admin & access control';
const EYEBROW = "Built for what's next";
const HEADLINE = 'A foundation for whatever you build on it.';
const SUBCOPY =
  'Multi-tenant from the first table, role-based access control that is enforced in the API and mirrored in the UI, and a module registry that wires navigation, routing and guards together.';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Role-based access control',
    body: 'Permissions derived from one typed catalog, enforced on every route.',
  },
  {
    icon: Building2,
    title: 'Multi-tenant by default',
    body: 'Every query is scoped to the signed-in account’s organisation.',
  },
  {
    icon: LayoutGrid,
    title: 'Add a module without touching the router',
    body: 'One registry entry generates the nav item, the route and its guard.',
  },
];

export const AuthLayout = () => (
  <div className="grid min-h-screen lg:grid-cols-2">
    <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <SquareStack className="size-5" strokeWidth={2.5} />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-tight">{APP_NAME}</span>
            <span className="block text-2xs text-muted-foreground">{TAGLINE}</span>
          </span>
        </div>

        {/* Its own boundary, inside the branded shell: the logo and panel stay put
            while the form chunk arrives, instead of the whole page being replaced
            by a spinner. The root boundary in `App` would otherwise blank it. */}
        <Suspense fallback={<LoadingState variant="page" label="Loading…" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>

    <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-white/20 blur-3xl"
      />

      <div className="relative p-12">
        <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
          {EYEBROW}
        </p>
        <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-primary-foreground">
          {HEADLINE}
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-primary-foreground/80">
          {SUBCOPY}
        </p>
      </div>

      <ul className="relative space-y-4 p-12">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15 text-primary-foreground">
              <Icon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-primary-foreground">{title}</span>
              <span className="block text-xs text-primary-foreground/75">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  </div>
);
