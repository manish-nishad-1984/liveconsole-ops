import { Monitor, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { useUiStore, type Theme } from '@/store/ui.store';

/**
 * Light → dark → system, on click.
 *
 * A three-state cycle rather than a two-state switch because "system" is a real
 * preference, not the absence of one: a user who wants the app to follow their OS
 * at sunset cannot express that with a toggle.
 */

const NEXT: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL: Record<Theme, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'Follows your system',
};

export const ThemeToggle = () => {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  const Icon = ICON[theme];

  return (
    <Hint label={`${LABEL[theme]} — switch to ${LABEL[NEXT[theme]].toLowerCase()}`}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Theme: ${LABEL[theme]}. Change theme.`}
        onClick={() => setTheme(NEXT[theme])}
        className="text-muted-foreground"
      >
        <Icon />
      </Button>
    </Hint>
  );
};
