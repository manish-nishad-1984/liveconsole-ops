import { NAV_GROUPS, getModulesByGroup } from '@liveconsole-ops/shared';
import { LogOut, Palette } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { usePermissions } from '@/hooks/use-permissions';
import { resolveIcon } from '@/lib/icons';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore, type Theme } from '@/store/ui.store';

/**
 * Ctrl/⌘-K navigation.
 *
 * Read-only and navigational on purpose: a palette that jumps between screens is
 * a real quality-of-life win with zero backend dependency. Cross-module data
 * search ("find the customer named…") waits until there is a search endpoint to
 * back it, rather than shipping a box that quietly matches nothing.
 *
 * Entries are filtered through the same permission check the sidebar uses — the
 * palette never lists something a click would only 403 on.
 */

const THEME_CYCLE: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { canAccessModule } = usePermissions();
  const logout = useAuthStore((state) => state.logout);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  // The global shortcut. `preventDefault` matters: Ctrl+K is the browser's own
  // "focus the search bar" on some platforms, and losing the keystroke to that
  // is indistinguishable from the palette being broken.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        group,
        modules: getModulesByGroup(group.key).filter((module) => canAccessModule(module.key)),
      })).filter(({ modules }) => modules.length > 0),
    [canAccessModule],
  );

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a screen…" />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        {groups.map(({ group, modules }) => (
          <CommandGroup key={group.key} heading={group.label}>
            {modules.map((module) => {
              const Icon = resolveIcon(module.icon);
              return (
                <CommandItem
                  key={module.key}
                  value={`${module.label} ${module.description}`}
                  onSelect={() => run(() => navigate(module.path))}
                >
                  <Icon />
                  <span>{module.label}</span>
                  <span className="ml-auto truncate pl-4 text-2xs text-muted-foreground">
                    {module.path}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem
            value="toggle theme appearance dark light"
            onSelect={() => run(() => setTheme(THEME_CYCLE[theme]))}
          >
            <Palette />
            <span>Toggle theme</span>
            <CommandShortcut>{theme}</CommandShortcut>
          </CommandItem>
          <CommandItem value="sign out log out" onSelect={() => run(() => void logout())}>
            <LogOut />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
