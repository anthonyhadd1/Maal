import { create } from 'zustand';

import { clearTokens, loadStoredTokens, registerAuthFailureHandler } from '@/api/client';
import { queryClient } from '@/api/queryClient';

export type AuthStatus = 'boot' | 'authed' | 'anon';

interface AuthState {
  status: AuthStatus;
  /** Boot-time: hydrate tokens from secure store, resolve boot -> authed/anon. */
  bootstrap: () => Promise<void>;
  setAuthed: () => void;
  /** Purge tokens + query cache, drop to anon. Safe to call repeatedly. */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'boot',

  bootstrap: async () => {
    try {
      const hasSession = await loadStoredTokens();
      set({ status: hasSession ? 'authed' : 'anon' });
    } catch {
      set({ status: 'anon' });
    }
  },

  setAuthed: () => set({ status: 'authed' }),

  logout: async () => {
    await clearTokens();
    queryClient.clear();
    set({ status: 'anon' });
  },
}));

// Refresh failure (expired/revoked session) -> global logout.
registerAuthFailureHandler(() => {
  void useAuthStore.getState().logout();
});
