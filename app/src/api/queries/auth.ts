import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { api, authApi, REFRESH_TOKEN_KEY, setTokens } from '@/api/client';
import * as SecureStore from '@/lib/secureStorage';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import { queryClient } from '@/api/queryClient';
import type {
  LoginPayload,
  Me,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  RegisterPayload,
  RegisterResponse,
  Tokens,
} from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

export function useMe() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => (await api.get<Me>(ENDPOINTS.me)).data,
    enabled: status === 'authed',
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const body: RegisterPayload = {
        username: payload.username,
        password: payload.password,
        display_name: payload.display_name ?? '',
        email: payload.email,
      };
      return (await authApi.post<RegisterResponse>(ENDPOINTS.authRegister, body)).data;
    },
    onSuccess: async (data) => {
      await setTokens(data.tokens);
      queryClient.setQueryData(keys.me, data.user);
      useAuthStore.getState().setAuthed();
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (payload: LoginPayload) =>
      (await authApi.post<Tokens>(ENDPOINTS.authToken, payload)).data,
    onSuccess: async (tokens) => {
      await setTokens(tokens);
      useAuthStore.getState().setAuthed();
      await queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/** Step 1 of recovery — email a 6-digit reset code. Always resolves 200 server-side
 * (the response never reveals whether the address is registered). */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (payload: PasswordResetRequestPayload) =>
      (await authApi.post(ENDPOINTS.authPasswordReset, payload)).data,
  });
}

/** Step 2 of recovery — verify the code + set a new password. */
export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async (payload: PasswordResetConfirmPayload) =>
      (await authApi.post(ENDPOINTS.authPasswordResetConfirm, payload)).data,
  });
}

export function useLogout() {
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (refresh) {
        try {
          await api.post(ENDPOINTS.authLogout, { refresh });
        } catch {
          // Logout is idempotent server-side; local purge below always runs.
        }
      }
    },
    onSettled: async () => {
      await useAuthStore.getState().logout();
      // The (tabs) auth gate reacts to status changes, but ONLY for the
      // screen currently on top of the stack. Logout is commonly triggered
      // from a PUSHED route (e.g. /profile/settings, sitting above the tabs
      // navigator) — the gate redirects the tabs layout underneath, but the
      // pushed screen stays visible with its now-disabled queries, frozen on
      // its loading skeleton forever. Explicitly unwind back to the root so
      // the gate's redirect is actually seen, from any screen that logs out.
      router.dismissTo('/');
    },
  });
}
