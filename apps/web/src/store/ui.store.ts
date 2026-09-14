import { APP_SLUG, NAV_GROUPS } from '@liveconsole-ops/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Shell preferences. Persisted to localStorage because a collapsed sidebar or a
 * chosen theme surviving a reload is the whole point — none of it is sensitive,
 * and none of it is session state.
 */

export type Theme = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'comfortable';

interface UiState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  /** Keys of the sidebar groups currently expanded. */
  expandedNavGroups: string[];
  theme: Theme;
  density: Density;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleNavGroup: (key: string) => void;
  expandNavGroup: (key: string) => void;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
}

/**
 * First run opens every group, so a new user sees the whole application rather
 * than a column of closed folders. Their own choices are persisted from then on.
 */
const DEFAULT_EXPANDED_GROUPS = NAV_GROUPS.filter((group) => !group.standalone).map(
  (group) => group.key,
);

const applyTheme = (theme: Theme): void => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      // Never persisted — a mobile drawer must always start closed.
      mobileSidebarOpen: false,
      expandedNavGroups: DEFAULT_EXPANDED_GROUPS,
      theme: 'light',
      density: 'compact',

      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),

      toggleNavGroup: (key) => {
        const current = get().expandedNavGroups;
        set({
          expandedNavGroups: current.includes(key)
            ? current.filter((item) => item !== key)
            : [...current, key],
        });
      },

      expandNavGroup: (key) => {
        const current = get().expandedNavGroups;
        if (current.includes(key)) return;
        set({ expandedNavGroups: [...current, key] });
      },

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },

      setDensity: (density) => set({ density }),
    }),
    {
      name: `${APP_SLUG}-ui`,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        expandedNavGroups: state.expandedNavGroups,
        theme: state.theme,
        density: state.density,
      }),
      // Applied during rehydration, before first paint, so a saved dark
      // preference does not flash light on a hard refresh.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

/** Keep a `system` choice in step with the OS if it changes mid-session. */
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useUiStore.getState();
    if (theme === 'system') applyTheme('system');
  });
}
