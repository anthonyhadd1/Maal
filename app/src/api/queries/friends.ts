import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import { queryClient } from '@/api/queryClient';
import type { Friend, FriendRequests, UserSearchResult } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

export const SEARCH_MIN_CHARS = 2;

export function useFriends() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.friends,
    queryFn: async () => (await api.get<Friend[]>(ENDPOINTS.friends)).data,
    staleTime: 30_000,
    enabled: status === 'authed',
  });
}

export function useFriendRequests() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.friendRequests,
    queryFn: async () => (await api.get<FriendRequests>(ENDPOINTS.friendRequests)).data,
    staleTime: 30_000,
    enabled: status === 'authed',
  });
}

/** Debounce the input BEFORE passing it here (features/friends/useDebouncedValue). */
export function useUserSearch(q: string) {
  const status = useAuthStore((s) => s.status);
  const term = q.trim();
  return useQuery({
    queryKey: keys.userSearch(term),
    queryFn: async () =>
      (await api.get<UserSearchResult[]>(ENDPOINTS.usersSearch, { params: { q: term } })).data,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: status === 'authed' && term.length >= SEARCH_MIN_CHARS,
  });
}

// --- mutations --------------------------------------------------------------

async function invalidateFriendState(): Promise<void> {
  await Promise.all([
    // keys.friends is the root of keys.friendRequests — one call covers both.
    queryClient.invalidateQueries({ queryKey: keys.friends }),
    queryClient.invalidateQueries({ queryKey: keys.userSearchRoot }),
    queryClient.invalidateQueries({ queryKey: keys.leaderboardFriends }),
  ]);
}

export function useSendFriendRequest() {
  return useMutation({
    mutationFn: async (username: string) =>
      (await api.post(ENDPOINTS.friendRequests, { username })).data,
    onSuccess: invalidateFriendState,
  });
}

export function useAcceptFriendRequest() {
  return useMutation({
    mutationFn: async (requestId: number) =>
      (await api.post(ENDPOINTS.friendRequestAccept(requestId), {})).data,
    onSuccess: invalidateFriendState,
  });
}

export function useDeclineFriendRequest() {
  return useMutation({
    mutationFn: async (requestId: number) =>
      (await api.post(ENDPOINTS.friendRequestDecline(requestId), {})).data,
    onSuccess: invalidateFriendState,
  });
}

export function useRemoveFriend() {
  return useMutation({
    mutationFn: async (userId: number) => (await api.delete(ENDPOINTS.friendRemove(userId))).data,
    onSuccess: invalidateFriendState,
  });
}
