import type { AuthUser, UpdateProfileRequest } from '@liveconsole-ops/types';
import { toast } from 'sonner';
import { create } from 'zustand';

import { setAccessToken, setSessionExpiredHandler } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { authService } from '@/services/auth.service';

/**
 * Session state.
 *
 * `status` is an explicit machine rather than a pair of booleans, because the
 * router has to distinguish "we have not checked yet" from "checked, not signed
 * in" — conflating them flashes the login screen on every page load.
 *
 * The access token is held by the API client (in a module variable), not in this
 * store, so it is never serialised into devtools or persisted state. The refresh
 * token is an httpOnly cookie the JavaScript never sees at all.
 */

export type AuthStatus = 'initialising' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;

  /** Restore a session from the httpOnly refresh cookie on app start. */
  bootstrap: () => Promise<void>;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Sign out of every device, including this one. */
  logoutEverywhere: () => Promise<void>;
  /** Called when a refresh fails mid-session. */
  endSession: (reason?: string) => void;
  setUser: (user: AuthUser) => void;
  /** Re-read the account — roles and permissions may have changed under us. */
  refreshUser: () => Promise<void>;
  updateProfile: (payload: UpdateProfileRequest) => Promise<AuthUser>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'initialising',
  user: null,

  bootstrap: async () => {
    try {
      const { user, tokens } = await authService.refresh();
      setAccessToken(tokens.accessToken);
      set({ status: 'authenticated', user });
    } catch {
      // No cookie, or it has expired — a normal first visit.
      setAccessToken(null);
      set({ status: 'unauthenticated', user: null });
    }
  },

  login: async (identifier, password, rememberMe = false) => {
    const { user, tokens } = await authService.login({ identifier, password, rememberMe });
    setAccessToken(tokens.accessToken);
    // A stale cache from a previous user on this browser must not survive a
    // sign-in: the next screen would render someone else's rows.
    queryClient.clear();
    set({ status: 'authenticated', user });
    return user;
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      // Sign out locally even if the request failed — the user asked to leave.
      setAccessToken(null);
      set({ status: 'unauthenticated', user: null });
      queryClient.clear();
    }
  },

  logoutEverywhere: async () => {
    try {
      await authService.logoutAll();
    } finally {
      setAccessToken(null);
      set({ status: 'unauthenticated', user: null });
      queryClient.clear();
    }
  },

  endSession: (reason) => {
    if (get().status === 'unauthenticated') return;

    setAccessToken(null);
    set({ status: 'unauthenticated', user: null });
    queryClient.clear();

    // The redirect alone looks like the app logged them out at random, so say why.
    toast.info('Signed out', {
      description: reason ?? 'Your session ended. Please sign in again.',
    });
  },

  setUser: (user) => set({ user }),

  refreshUser: async () => {
    const user = await authService.me();
    set({ user });
  },

  updateProfile: async (payload) => {
    const user = await authService.updateProfile(payload);
    set({ user });
    return user;
  },
}));

// Wire the API client's "refresh failed" signal back into the store, so a dead
// session collapses the UI to the login screen from anywhere in the app.
setSessionExpiredHandler(() => {
  useAuthStore.getState().endSession();
});
