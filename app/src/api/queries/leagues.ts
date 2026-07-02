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

/** GET /league/ — my weekly cohort. rows=[] + rank=null → not joined yet. */
export function useLeague({ focused = false, enabled = true }: BoardOptions = {}) {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.league,
    queryFn: async () => (await api.get<LeagueResponse>(ENDPOINTS.league)).data,
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
    queryFn: async () => (await api.get<LeaderboardRow[]>(ENDPOINTS.leaderboardFriends)).data,
    staleTime: 15_000,
    refetchInterval: focused ? POLL_INTERVAL_MS : false,
    enabled: status === 'authed' && enabled,
  });
}
