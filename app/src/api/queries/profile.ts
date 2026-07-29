import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import { queryClient } from '@/api/queryClient';
import type { Faculty, Me, Profile } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

/** PATCH /me/ body — nested profile fields (backend serializer shape). */
export interface PatchMePayload {
  email?: string;
  profile?: Partial<Profile>;
}

/**
 * PATCH /me/ — display_name, avatar_id, target_faculty, daily_goal_xp,
 * leagues_opt_in, onboarding_completed… Returns the updated Me.
 */
export function usePatchMe() {
  return useMutation({
    mutationFn: async (payload: PatchMePayload) =>
      (await api.patch<Me>(ENDPOINTS.me, payload)).data,
    onSuccess: async (data, payload) => {
      queryClient.setQueryData(keys.me, data);
      // Opting in/out of leagues changes what /league/ returns.
      if (payload.profile && 'leagues_opt_in' in payload.profile) {
        await queryClient.invalidateQueries({ queryKey: keys.league });
      }
    },
  });
}

/** DELETE /me/ — App Store requirement. Caller logs out on success. */
export function useDeleteAccount() {
  const router = useRouter();
  return useMutation({
    mutationFn: async () => (await api.delete(ENDPOINTS.me)).data,
    onSuccess: async () => {
      await useAuthStore.getState().logout();
      // Same fix as useLogout() (see api/queries/auth.ts) — this is always
      // triggered from the pushed /profile/settings route, so the (tabs)
      // auth gate's redirect is never seen without explicitly unwinding
      // back to the root first. Without this, the screen was observed to
      // stay frozen on its now-unauthenticated "Réglages" shell indefinitely.
      router.dismissTo('/');
    },
  });
}

/** GET /faculties/ — onboarding goal step (public catalog). */
export function useFaculties() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.faculties,
    queryFn: async () => (await api.get<Faculty[]>(ENDPOINTS.faculties)).data,
    staleTime: 24 * 60 * 60 * 1000,
    enabled: status === 'authed',
  });
}
