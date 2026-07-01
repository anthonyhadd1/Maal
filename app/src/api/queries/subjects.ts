import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { Subject } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

const FIVE_MINUTES = 5 * 60 * 1000;

export function useSubjects() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.subjects,
    queryFn: async () => (await api.get<Subject[]>(ENDPOINTS.subjects)).data,
    staleTime: FIVE_MINUTES,
    enabled: status === 'authed',
  });
}
