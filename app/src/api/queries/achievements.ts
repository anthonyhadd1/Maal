import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { AchievementItem } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

/** GET /achievements/ — the full trophy catalog + my unlock state. */
export function useAchievements() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.achievements,
    queryFn: async () => (await api.get<AchievementItem[]>(ENDPOINTS.achievements)).data,
    staleTime: 60_000,
    enabled: status === 'authed',
  });
}
