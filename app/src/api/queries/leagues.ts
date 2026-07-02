import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import type { LeaderboardRow, LeagueResponse } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

/** "Real-time" = fast polling while the tab is focused (design_mobile.md §5). */
const POLL_INTERVAL_MS = 30_000;

interface BoardOptions {
  /** Poll every 30 s while true (screen focused). */
  focused?: boolean;
  enabled?: boolean;
}

/**
 * The backend nests rank/cutoffs/week (`me.rank`, `cutoffs.promote_count`,
 * `week.ends_at`) while the app consumes the flat LeagueResponse shape.
 * Accept both so either side can evolve without breaking the tab.
 */
export function normalizeLeague(raw: unknown): LeagueResponse {
  const data = (raw ?? {}) as Record<string, any>;
  const me = (data.me ?? null) as { rank?: number; xp_week?: number } | null;
  const cutoffs = (data.cutoffs ?? {}) as { promote_count?: number; demote_count?: number };
  const week = (data.week ?? {}) as { ends_at?: string };

  return {
    tier: data.tier ?? null,
    rank: data.rank ?? me?.rank ?? null,
    xp_week: data.xp_week ?? me?.xp_week ?? 0,
    week_ends_at: data.week_ends_at ?? week.ends_at ?? '',
    promote_count: data.promote_count ?? cutoffs.promote_count ?? 0,
    demote_count: data.demote_count ?? cutoffs.demote_count ?? 0,
    rows: Array.isArray(data.rows) ? (data.rows as LeaderboardRow[]) : [],
  };
}

/** Friends board: the backend wraps rows in `{week, rows}` — accept both. */
export function normalizeRows(raw: unknown): LeaderboardRow[] {
  if (Array.isArray(raw)) return raw as LeaderboardRow[];
  const rows = (raw as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as LeaderboardRow[]) : [];
}

/** GET /league/ — my weekly cohort. rows=[] + rank=null → not joined yet. */
export function useLeague({ focused = false, enabled = true }: BoardOptions = {}) {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.league,
    queryFn: async () => normalizeLeague((await api.get<unknown>(ENDPOINTS.league)).data),
    staleTime: 15_000,
    refetchInterval: focused ? POLL_INTERVAL_MS : false,
    enabled: status === 'authed' && enabled,
  });
}

/** GET /leaderboard/friends/ — friends + me, same row shape as the league. */
export function useFriendsLeaderboard({ focused = false, enabled = true }: BoardOptions = {}) {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.leaderboardFriends,
    queryFn: async () =>
      normalizeRows((await api.get<unknown>(ENDPOINTS.leaderboardFriends)).data),
    staleTime: 15_000,
    refetchInterval: focused ? POLL_INTERVAL_MS : false,
    enabled: status === 'authed' && enabled,
  });
}
