import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { MeStats } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

/** GET /me/stats/ — totals for everyone; per-subject + xp_by_day when premium. */
export function useMeStats() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.stats(),
    queryFn: async () => (await api.get<MeStats>(ENDPOINTS.meStats)).data,
    staleTime: 60_000,
    enabled: status === 'authed',
  });
}
