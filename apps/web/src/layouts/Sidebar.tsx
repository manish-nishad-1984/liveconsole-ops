import { APP_NAME } from '@liveconsole-ops/shared';
import { Link } from 'react-router-dom';

import { BrandLogo, BrandMark } from '@/components/common/BrandLogo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SidebarNav } from '@/layouts/SidebarNav';
import { ROUTES } from '@/routes/paths';
import { useUiStore } from '@/store/ui.store';
import { cn } from '@/lib/utils';

/**
 * The sidebar, in three presentations of one navigation tree: a full rail, a
 * collapsed icon rail, and a drawer below `lg`. Only the width and the nav's own
 * `collapsed` flag differ — the tree itself is built once, in `SidebarNav`.
 */

const Brand = ({ collapsed = false }: { collapsed?: boolean }) => (
  <Link
    to={ROUTES.dashboard}
    aria-label={APP_NAME}
    className={cn(
      'flex h-topbar shrink-0 items-center gap-3 border-b border-border px-4',
      collapsed && 'justify-center px-0',
    )}
  >
    {collapsed ? (
      <BrandMark className="size-8" />
    ) : (
      <>
        <BrandLogo className="h-9" />
        <span aria-hidden className="h-5 w-px bg-border" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Ops
        </span>
      </>
    )}
  </Link>
);

/** Fixed sidebar for `lg` and up. Collapses to an icon rail with flyout groups. */
export const Sidebar = () => {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex',
        sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <Brand collapsed={sidebarCollapsed} />

      <ScrollArea className="flex-1">
        <SidebarNav collapsed={sidebarCollapsed} />
      </ScrollArea>
    </aside>
  );
};

/** Drawer variant for tablet and phone widths. Always renders the full tree. */
export const MobileSidebar = () => {
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen);
  const setMobileSidebarOpen = useUiStore((state) => state.setMobileSidebarOpen);

  return (
    <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Brand />
        <ScrollArea className="flex-1">
          {/* Tapping a link closes the drawer — on a phone it covers the page. */}
          <SidebarNav onNavigate={() => setMobileSidebarOpen(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
