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
  // Same fix as useLogout()/useDeleteAccount() (see api/queries/auth.ts,
  // profile.ts) — this can fire from ANY screen (a token refresh can fail
  // while pushed above the tabs navigator, e.g. mid-session or on a profile
  // sub-screen), and the (tabs) auth gate's redirect is only ever seen by
  // whichever screen is currently on top of the stack. Without unwinding
  // first, the app would freeze on whatever screen happened to be open,
  // now silently unauthenticated.
  //
  // Lazy require (not a top-level import): expo-router's main entrypoint
  // transitively pulls in the ESM-only `standard-navigation` package, which
  // breaks every Jest suite that imports this store (i.e. nearly all of
  // them) with "Cannot use import statement outside a module". Deferring
  // the require to inside this callback — which only ever runs against a
  // real navigation tree, never during module load in tests — avoids that
  // entirely.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('expo-router') as typeof import('expo-router')).router.dismissTo('/');
});
