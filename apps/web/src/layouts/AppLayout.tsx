import { APP_NAME } from '@liveconsole-ops/shared';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { CommandPalette } from '@/components/common/CommandPalette';
import { LoadingState } from '@/components/common/LoadingState';
import { MobileSidebar, Sidebar } from '@/layouts/Sidebar';
import { Topbar } from '@/layouts/Topbar';
import { useUiStore } from '@/store/ui.store';
import { cn } from '@/lib/utils';

/**
 * The authenticated application shell.
 *
 * Desktop gets a fixed sidebar and the content area is offset by its width; below
 * `lg` the sidebar becomes a drawer and the offset disappears. The `Suspense`
 * boundary catches the lazily-loaded module pages so navigation shows a spinner
 * rather than a blank frame.
 *
 * The shell owns no page content whatsoever — every screen composes its own from
 * `PageLayout` and the shared components, which is what keeps a module from
 * quietly inventing a second layout.
 */
export const AppLayout = () => {
  const { pathname } = useLocation();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setMobileSidebarOpen = useUiStore((state) => state.setMobileSidebarOpen);

  // Mounted once here so the palette is available on every authenticated screen.
  const [paletteOpen, setPaletteOpen] = useState(false);

  // A route change while the drawer is open would otherwise leave it covering the
  // page the user just navigated to.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  return (
    <div className="min-h-full bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar />
      <MobileSidebar />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          sidebarCollapsed ? 'lg:pl-sidebar-collapsed' : 'lg:pl-sidebar',
        )}
      >
        <Topbar onOpenCommandPalette={() => setPaletteOpen(true)} />

        <main id="main-content" className="flex-1 px-3 py-4 sm:px-5 sm:py-5">
          {/* Capped width keeps dense tables readable on ultrawide monitors. */}
          <div className="mx-auto w-full max-w-[110rem]">
            <Suspense fallback={<LoadingState variant="page" label="Loading module…" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <footer className="border-t border-border px-5 py-3 text-2xs text-muted-foreground no-print">
          <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-2">
            <span>
              © {new Date().getFullYear()} {APP_NAME}
            </span>
            <span className="numeric">v{__APP_VERSION__}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
