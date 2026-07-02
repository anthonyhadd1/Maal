import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { QuestsToday } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

/** GET /quests/today/ — daily goal ring + the 3 static daily quests. */
export function useQuestsToday() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.quests,
    queryFn: async () => (await api.get<QuestsToday>(ENDPOINTS.questsToday)).data,
    staleTime: 30_000,
    enabled: status === 'authed',
  });
}
