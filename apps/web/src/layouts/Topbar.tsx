import { getModuleByPath, getNavGroup } from '@liveconsole-ops/shared';
import { ChevronRight, Menu, PanelLeft, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Hint } from '@/components/ui/tooltip';
import { UserMenu } from '@/layouts/UserMenu';
import { useUiStore } from '@/store/ui.store';

/**
 * The top bar: navigation triggers and location on the left, global controls on
 * the right.
 *
 * It shows the section and module — "Administration › Users" — rather than
 * repeating the page title. The page owns its title through `PageHeader`; the top
 * bar answers a different question, which is where in the application you are.
 */

/** ⌘ on Apple platforms, Ctrl everywhere else. Detected once, on mount. */
const useShortcutPrefix = (): string => {
  const [prefix, setPrefix] = useState('Ctrl');

  useEffect(() => {
    if (/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)) setPrefix('⌘');
  }, []);

  return prefix;
};

export const Topbar = ({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) => {
  const { pathname } = useLocation();
  const setMobileSidebarOpen = useUiStore((state) => state.setMobileSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const shortcutPrefix = useShortcutPrefix();

  const currentModule = getModuleByPath(pathname);
  const currentGroup = currentModule ? getNavGroup(currentModule.group) : undefined;
  // A standalone group wraps a single entry — naming it would read as
  // "General › Dashboard", which tells the user nothing they cannot already see.
  const showGroup = currentGroup && !currentGroup.standalone;

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Open navigation"
        onClick={() => setMobileSidebarOpen(true)}
        className="text-muted-foreground lg:hidden"
      >
        <Menu />
      </Button>

      <Hint label="Toggle sidebar">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle sidebar"
          onClick={toggleSidebar}
          className="hidden text-muted-foreground lg:inline-flex"
        >
          <PanelLeft />
        </Button>
      </Hint>

      {currentModule ? (
        <nav aria-label="Location" className="flex min-w-0 items-center gap-1 text-sm">
          {showGroup ? (
            <>
              <span className="hidden text-muted-foreground md:inline">{currentGroup.label}</span>
              <ChevronRight
                aria-hidden
                className="hidden size-3.5 shrink-0 text-muted-foreground/60 md:inline"
              />
            </>
          ) : null}
          <span className="truncate font-medium">{currentModule.label}</span>
        </nav>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        {/*
         * The visible affordance for the palette. Without it the shortcut is a
         * secret: people who do not already know about ⌘K never discover it.
         */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Open the command palette"
          className="hidden h-8 items-center gap-2 rounded-md border border-input bg-card px-2.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
        >
          <Search className="size-3.5" />
          <span>Search</span>
          <kbd className="ml-4 rounded border border-border bg-muted px-1 py-0.5 font-sans text-2xs">
            {shortcutPrefix}K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open the command palette"
          onClick={onOpenCommandPalette}
          className="text-muted-foreground sm:hidden"
        >
          <Search />
        </Button>

        <ThemeToggle />

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <UserMenu />
      </div>
    </header>
  );
};
