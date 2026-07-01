/**
 * Central query-key factory (design_mobile.md §5).
 * Every useQuery/useMutation invalidation goes through these — never inline keys.
 */
export const keys = {
  me: ['me'] as const,
  subjects: ['subjects'] as const,
  map: (subjectSlug: string) => ['map', subjectSlug] as const,
  hearts: ['hearts'] as const,
  league: ['league', 'current'] as const,
  leaderboard: (leagueId: number | string) => ['leaderboard', leagueId] as const,
  friends: ['friends'] as const,
  friendRequests: ['friends', 'requests'] as const,
  achievements: ['achievements'] as const,
  quests: ['quests'] as const,
  stats: (subjectSlug?: string) => ['stats', subjectSlug ?? 'all'] as const,
} as const;
