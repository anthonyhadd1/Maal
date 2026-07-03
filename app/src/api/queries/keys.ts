/**
 * Central query-key factory (design_mobile.md §5).
 * Every useQuery/useMutation invalidation goes through these — never inline keys.
 */
export const keys = {
  me: ['me'] as const,
  tracks: ['tracks'] as const,
  /** Per-track subjects list (flat or tiered — see SubjectsResponse). */
  subjects: (trackSlug: string = 'concours') => ['subjects', trackSlug] as const,
  map: (subjectSlug: string) => ['map', subjectSlug] as const,
  /** Root key — invalidates every subject map at once (post-completion). */
  mapRoot: ['map'] as const,
  /** /me/game/ gamification summary (hearts, streak, XP, league). */
  game: ['game'] as const,
  hearts: ['hearts'] as const,
  league: ['league', 'current'] as const,
  leaderboard: (leagueId: number | string) => ['leaderboard', leagueId] as const,
  leaderboardFriends: ['leaderboard', 'friends'] as const,
  friends: ['friends'] as const,
  friendRequests: ['friends', 'requests'] as const,
  achievements: ['achievements'] as const,
  quests: ['quests'] as const,
  practiceMistakes: ['practice', 'mistakes'] as const,
  stats: (subjectSlug?: string) => ['stats', subjectSlug ?? 'all'] as const,
  entitlement: ['entitlement'] as const,
  faculties: ['faculties'] as const,
  /** Root key — invalidates the list AND every detail at once. */
  challenges: ['challenges'] as const,
  challengeDetail: (id: number) => ['challenges', 'detail', id] as const,
  /** Root key — invalidates every cached search term after a friend action. */
  userSearchRoot: ['users', 'search'] as const,
  userSearch: (q: string) => ['users', 'search', q] as const,
} as const;
