import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth.store';

/**
 * Global providers, plus the one-time session bootstrap.
 *
 * The bootstrap runs before any route renders: it exchanges the httpOnly refresh
 * cookie for an access token so a page reload lands the user back where they were
 * instead of on the login screen.
 */
export const AppProviders = ({ children }: { children: ReactNode }) => {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
};
