/**
 * Backend path constants (relative to EXPO_PUBLIC_API_URL, which already
 * includes `/api/v1`). Mirrors docs/design_backend.md §4.
 */
export const ENDPOINTS = {
  // accounts
  authRegister: '/auth/register/',
  authToken: '/auth/token/',
  authRefresh: '/auth/token/refresh/',
  authLogout: '/auth/logout/',
  me: '/me/',
  meStats: '/me/stats/',
  meGame: '/me/game/',
  meEntitlement: '/me/entitlement/',
  faculties: '/faculties/',

  // content + map
  subjects: '/subjects/',
  subjectMap: (slug: string) => `/subjects/${slug}/map/` as const,

  // attempt flow (per-question grading — PLAN reconciled decision 1)
  levelAttempts: (levelId: number) => `/levels/${levelId}/attempts/` as const,
  /** GET — resume payload: questions + already-answered verdicts. */
  attemptDetail: (attemptId: number) => `/attempts/${attemptId}/` as const,
  attemptAnswers: (attemptId: number) => `/attempts/${attemptId}/answers/` as const,
  attemptComplete: (attemptId: number) => `/attempts/${attemptId}/complete/` as const,
  attemptAbandon: (attemptId: number) => `/attempts/${attemptId}/abandon/` as const,

  // practice
  practiceMistakes: '/practice/mistakes/',
  practiceAttempts: '/practice/attempts/',

  // gamification
  league: '/league/',
  leaderboardFriends: '/leaderboard/friends/',
  achievements: '/achievements/',
  questsToday: '/quests/today/',

  // social — friends
  friends: '/friends/',
  friendRemove: (userId: number) => `/friends/${userId}/` as const,
  friendRequests: '/friends/requests/',
  friendRequestAccept: (id: number) => `/friends/requests/${id}/accept/` as const,
  friendRequestDecline: (id: number) => `/friends/requests/${id}/decline/` as const,
  usersSearch: '/users/search/',

  // social — challenges
  challenges: '/challenges/',
  challengeDetail: (id: number) => `/challenges/${id}/` as const,
  challengeAccept: (id: number) => `/challenges/${id}/accept/` as const,
  challengeDecline: (id: number) => `/challenges/${id}/decline/` as const,
  /** Same payload as a level attempt start: {attempt_id, questions[…]}. */
  challengeAttempts: (id: number) => `/challenges/${id}/attempts/` as const,
} as const;
