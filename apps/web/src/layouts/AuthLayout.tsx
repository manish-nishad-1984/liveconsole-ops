import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { CheckCircle2, Truck, Wallet } from 'lucide-react';

import { BrandLogo } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';

/**
 * Shell for the unauthenticated screens (sign in, forgot password, reset).
 *
 * Split layout: the form on the left keeps focus where the work is, and the
 * right-hand panel — hidden below `lg` — carries the identity without competing
 * with it. The panel is always dark, whatever the theme, because that is the
 * surface the LiveConsole logo is drawn for; the logo's red → orange → amber
 * gradient glows behind it as blurred shapes rather than as a background image.
 */

const HEADLINE = 'Site cash and vehicles, accounted for.';
const SUBCOPY =
  'Record what is handed out and spent at every site, with the receipts attached, and keep track of every hired vehicle and what is still owed on it.';

const FEATURES = [
  {
    icon: Wallet,
    title: 'Petty cash',
    body: 'Cash and UPI issued to employees, with a running balance for each.',
  },
  {
    icon: CheckCircle2,
    title: 'Expenses with receipts',
    body: 'A photo of the bill, filed from the phone and off the balance at once.',
  },
  {
    icon: Truck,
    title: 'Vehicle rentals',
    body: 'Rent per day or per job, payments, and what is pending by site.',
  },
];

export const AuthLayout = () => (
  <div className="grid min-h-screen lg:grid-cols-2">
    <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo className="h-12" />
          <span aria-hidden className="h-6 w-px bg-border" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ops
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

    <aside className="relative hidden overflow-hidden bg-neutral-950 text-white lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-28 size-[28rem] rounded-full bg-brand-amber/35 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-24 top-40 size-72 rounded-full bg-brand-orange/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-brand-red/30 blur-3xl"
      />

      <div className="relative p-12">
        <BrandLogo surface="dark" className="h-14" />
        <h2 className="mt-10 max-w-md text-3xl font-semibold leading-tight">{HEADLINE}</h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">{SUBCOPY}</p>
      </div>

      <ul className="relative space-y-4 p-12">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-brand-amber ring-1 ring-white/10">
              <Icon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs text-white/70">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  </div>
);
