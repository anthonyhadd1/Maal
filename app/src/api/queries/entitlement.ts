import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { Entitlement } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

/** GET /me/entitlement/ — {is_premium, premium_until, source}. */
export function useEntitlement() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.entitlement,
    queryFn: async () => (await api.get<Entitlement>(ENDPOINTS.meEntitlement)).data,
    staleTime: 60_000,
    enabled: status === 'authed',
  });
}
