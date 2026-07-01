import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { MeGame } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

const THIRTY_SECONDS = 30_000;

/** Gamification summary: hearts (+unlimited flag), streak, XP, league. */
export function useMeGame() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.game,
    queryFn: async () => (await api.get<MeGame>(ENDPOINTS.meGame)).data,
    staleTime: THIRTY_SECONDS,
    enabled: status === 'authed',
  });
}
