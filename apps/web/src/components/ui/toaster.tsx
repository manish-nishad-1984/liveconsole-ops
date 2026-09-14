import { Toaster as SonnerToaster } from 'sonner';

import { useUiStore } from '@/store/ui.store';

/**
 * Toast host. Mounted once in the provider tree; everything else calls `toast()`
 * from sonner directly.
 */
export const Toaster = () => {
  const theme = useUiStore((state) => state.theme);

  return (
    <SonnerToaster
      theme={theme}
      position="top-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            'group rounded-md border border-border bg-card text-card-foreground shadow-popover text-sm',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground text-xs rounded px-2 py-1',
          cancelButton: 'bg-secondary text-secondary-foreground text-xs rounded px-2 py-1',
          error: 'border-status-danger/30 [&_[data-icon]]:text-status-danger',
          success: 'border-status-success/30 [&_[data-icon]]:text-status-success',
          warning: 'border-status-warning/30 [&_[data-icon]]:text-status-warning',
        },
      }}
    />
  );
};
