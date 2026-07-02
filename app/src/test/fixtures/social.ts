import type {
  AchievementItem,
  ChallengeDetail,
  ChallengesResponse,
  Entitlement,
  Friend,
  FriendRequests,
  IncomingChallenge,
  LeaderboardRow,
  LeagueResponse,
  MeStats,
  OutgoingChallenge,
  QuestsToday,
  UserSearchResult,
} from '@/api/types';

/**
 * Fixtures mirroring the Phase 7 backend contract EXACTLY (a parallel agent
 * implements the same shapes server-side):
 * league / leaderboard, quests/today, achievements, me/stats, entitlement,
 * friends + requests + search, challenges (+detail with per-question rows).
 */

export const MY_USERNAME = 'nabil';

export function boardRow(overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    rank: 1,
    username: 'user1',
    display_name: 'User One',
    avatar_id: 'ace-1',
    xp_week: 320,
    is_me: false,
    ...overrides,
  };
}

/** n ranked rows; `meRank` marks one of them as me. */
export function boardRows(n: number, meRank = 4): LeaderboardRow[] {
  return Array.from({ length: n }, (_, i) => {
    const rank = i + 1;
    return boardRow({
      rank,
      username: rank === meRank ? MY_USERNAME : `user${rank}`,
      display_name: rank === meRank ? 'Nabil' : `User ${rank}`,
      avatar_id: `ace-${(i % 8) + 1}`,
      xp_week: 1000 - rank * 25,
      is_me: rank === meRank,
    });
  });
}

export const leagueResponse: LeagueResponse = {
  tier: { name: 'Ligue Argent', icon: 'medal', color_hex: '#94A3B8' },
  rank: 4,
  xp_week: 900,
  week_ends_at: '2026-07-05T20:59:59Z',
  promote_count: 10,
  demote_count: 5,
  rows: boardRows(30),
};

/** Not joined yet: rows [] + rank null (empty-state branch). */
export const leagueNotJoined: LeagueResponse = {
  tier: null,
  rank: null,
  xp_week: 0,
  week_ends_at: '2026-07-05T20:59:59Z',
  promote_count: 10,
  demote_count: 5,
  rows: [],
};

export const questsToday: QuestsToday = {
  daily_goal: { target: 40, current: 26 },
  quests: [
    { code: 'daily_xp', title: 'Gagne 40 XP', target: 40, current: 26, done: false },
    { code: 'daily_levels', title: 'Termine 2 niveaux', target: 2, current: 2, done: true },
    { code: 'daily_review', title: 'Fais 1 Révision', target: 1, current: 0, done: false },
  ],
};

export function achievement(overrides: Partial<AchievementItem> = {}): AchievementItem {
  return {
    code: 'first_win',
    title: 'Première victoire',
    description: 'Termine ton premier niveau avec au moins 1 étoile.',
    icon: 'star',
    order: 1,
    is_premium_only: false,
    unlocked_at: null,
    threshold: 1,
    ...overrides,
  };
}

export const achievements: AchievementItem[] = [
  achievement({ code: 'first_win', order: 1, unlocked_at: '2026-06-20T10:00:00Z' }),
  achievement({
    code: 'marathon',
    title: 'Marathonien·ne',
    icon: 'zap',
    order: 10,
    threshold: 10,
    progress: 4,
  }),
  achievement({
    code: 'gold_collector',
    title: "Collectionneur·se d'or",
    icon: 'crown',
    order: 21,
    is_premium_only: true,
    threshold: 1,
  }),
];

export const statsFree: MeStats = {
  detailed: false,
  totals: { xp_total: 1234, levels_completed: 18, perfect_levels: 3, best_streak: 9 },
};

export const statsPremium: MeStats = {
  detailed: true,
  totals: { xp_total: 5210, levels_completed: 64, perfect_levels: 12, best_streak: 31 },
  per_subject: [
    {
      subject: { name: 'Chimie', slug: 'chimie', color_hex: '#06B6D4', icon: 'flask-conical' },
      accuracy_pct: 82,
      answered: 240,
      levels_completed: 12,
      stars_total: 28,
    },
  ],
  xp_by_day: Array.from({ length: 14 }, (_, i) => ({
    date: `2026-06-${String(17 + i).padStart(2, '0')}`,
    xp: (i * 13) % 60,
  })),
};

export const entitlementFree: Entitlement = {
  is_premium: false,
  premium_until: null,
  source: 'none',
};

export const entitlementPremium: Entitlement = {
  is_premium: true,
  premium_until: '2027-07-01T00:00:00Z',
  source: 'admin',
};

// --- friends ---------------------------------------------------------------

export const friends: Friend[] = [
  { user_id: 11, username: 'rita.k', display_name: 'Rita', avatar_id: 'ace-2', xp_week: 480 },
  { user_id: 12, username: 'karim', display_name: 'Karim', avatar_id: 'ace-5', xp_week: 120 },
];

export const friendRequests: FriendRequests = {
  incoming: [
    {
      id: 71,
      from: { user_id: 21, username: 'joe', display_name: 'Joe', avatar_id: 'ace-3' },
    },
  ],
  outgoing: [
    {
      id: 72,
      to: { user_id: 22, username: 'lea', display_name: 'Léa', avatar_id: 'ace-4' },
    },
  ],
};

export function searchResult(overrides: Partial<UserSearchResult> = {}): UserSearchResult {
  return {
    user_id: 31,
    username: 'sami',
    display_name: 'Sami',
    avatar_id: 'ace-6',
    friendship_status: 'none',
    ...overrides,
  };
}

// --- challenges --------------------------------------------------------------

const challengeLevel = {
  id: 7,
  title: 'Masse molaire et moles',
  subject: { name: 'Chimie', slug: 'chimie', color_hex: '#06B6D4', icon: 'flask-conical' },
};

export function incomingChallenge(
  overrides: Partial<IncomingChallenge> = {},
): IncomingChallenge {
  return {
    id: 9,
    level: challengeLevel,
    challenger: { user_id: 11, username: 'rita.k', display_name: 'Rita', avatar_id: 'ace-2' },
    status: 'pending',
    challenger_score: null,
    opponent_score: null,
    winner_username: null,
    expires_at: '2026-07-03T12:00:00Z',
    ...overrides,
  };
}

export function outgoingChallenge(
  overrides: Partial<OutgoingChallenge> = {},
): OutgoingChallenge {
  return {
    id: 10,
    level: challengeLevel,
    opponent: { user_id: 12, username: 'karim', display_name: 'Karim', avatar_id: 'ace-5' },
    status: 'pending',
    challenger_score: null,
    opponent_score: null,
    winner_username: null,
    expires_at: '2026-07-03T12:00:00Z',
    ...overrides,
  };
}

export const challengesResponse: ChallengesResponse = {
  incoming: [incomingChallenge()],
  outgoing: [outgoingChallenge()],
};

/** Completed detail — I am the opponent (Rita challenged me) and I won 8–6. */
export function challengeDetailCompleted(
  overrides: Partial<ChallengeDetail> = {},
): ChallengeDetail {
  return {
    id: 9,
    level: challengeLevel,
    challenger: { user_id: 11, username: 'rita.k', display_name: 'Rita', avatar_id: 'ace-2' },
    opponent: { user_id: 1, username: MY_USERNAME, display_name: 'Nabil', avatar_id: 'ace-1' },
    status: 'completed',
    challenger_score: 6,
    opponent_score: 8,
    winner_username: MY_USERNAME,
    expires_at: '2026-07-03T12:00:00Z',
    questions: [
      { challenger_correct: true, opponent_correct: true },
      { challenger_correct: false, opponent_correct: true },
      { challenger_correct: true, opponent_correct: false },
    ],
    ...overrides,
  };
}
