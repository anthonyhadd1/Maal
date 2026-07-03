import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { Track } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

const ONE_HOUR = 60 * 60 * 1000;

/** GET /tracks/ — top-level exam categories, ordered by `order`, no pagination. */
export function useTracks() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.tracks,
    queryFn: async () => (await api.get<Track[]>(ENDPOINTS.tracks)).data,
    staleTime: ONE_HOUR,
    enabled: status === 'authed',
  });
}
