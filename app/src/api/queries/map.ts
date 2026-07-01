import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { SubjectMap } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

const FIVE_MINUTES = 5 * 60 * 1000;

export function useSubjectMap(subjectSlug: string | null) {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.map(subjectSlug ?? '_none'),
    queryFn: async () => (await api.get<SubjectMap>(ENDPOINTS.subjectMap(subjectSlug!))).data,
    staleTime: FIVE_MINUTES,
    enabled: status === 'authed' && !!subjectSlug,
  });
}
