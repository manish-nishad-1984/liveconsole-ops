import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';

import { AppProviders } from '@/app/providers';
import { LoadingState } from '@/components/common/LoadingState';
import { router } from '@/routes/router';

/**
 * A Suspense boundary sits above the router as the application-wide safety net.
 *
 * Every route element is `lazy()`, and a lazy component that suspends with no
 * boundary above it does not degrade gracefully — React throws and the whole
 * screen is replaced by an error page. The authenticated branch has its own
 * boundary inside `AppLayout`; this one covers the guest branch, where a slow
 * connection would otherwise break the sign-in screen. On a fast link the module
 * arrives before React needs a fallback, which is exactly why this has to be a
 * boundary rather than something caught by testing locally.
 */
export const App = () => (
  <AppProviders>
    <Suspense fallback={<LoadingState variant="page" label="Loading…" />}>
      <RouterProvider router={router} />
    </Suspense>
  </AppProviders>
);

export default App;
