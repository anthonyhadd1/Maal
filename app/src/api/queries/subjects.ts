import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { SubjectsResponse } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * GET /subjects/?track=<slug> — defaults to 'concours' (hard backward-compat
 * requirement: existing call sites with no arg must keep compiling AND
 * behaving identically). Response is a discriminated union — SubjectFlat[]
 * for flat tracks, {track, years} for tiered tracks — narrow with
 * `isTieredSubjects` at the call site.
 */
export function useSubjects(trackSlug: string = 'concours') {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.subjects(trackSlug),
    queryFn: async () =>
      (await api.get<SubjectsResponse>(ENDPOINTS.subjects, { params: { track: trackSlug } })).data,
    staleTime: FIVE_MINUTES,
    enabled: status === 'authed',
  });
}
