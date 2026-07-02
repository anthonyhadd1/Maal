import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import { queryClient } from '@/api/queryClient';
import type {
  ChallengeDetail,
  ChallengesResponse,
  CreateChallengePayload,
  StartAttemptResponse,
} from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

export function useChallenges() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.challenges,
    queryFn: async () => (await api.get<ChallengesResponse>(ENDPOINTS.challenges)).data,
    staleTime: 30_000,
    enabled: status === 'authed',
  });
}

/**
 * GET /challenges/{id}/ — after completion the payload includes the
 * per-question comparison. staleTime 0: status flips server-side.
 */
export function useChallengeDetail(challengeId: number | null) {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.challengeDetail(challengeId ?? -1),
    queryFn: async () =>
      (await api.get<ChallengeDetail>(ENDPOINTS.challengeDetail(challengeId!))).data,
    staleTime: 0,
    enabled: status === 'authed' && challengeId != null,
  });
}

async function invalidateChallenges(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: keys.challenges });
}

export function useCreateChallenge() {
  return useMutation({
    mutationFn: async (payload: CreateChallengePayload) =>
      (await api.post(ENDPOINTS.challenges, payload)).data,
    onSuccess: invalidateChallenges,
  });
}

export function useAcceptChallenge() {
  return useMutation({
    mutationFn: async (challengeId: number) =>
      (await api.post(ENDPOINTS.challengeAccept(challengeId), {})).data,
    onSuccess: invalidateChallenges,
  });
}

export function useDeclineChallenge() {
  return useMutation({
    mutationFn: async (challengeId: number) =>
      (await api.post(ENDPOINTS.challengeDecline(challengeId), {})).data,
    onSuccess: invalidateChallenges,
  });
}

/**
 * POST /challenges/{id}/attempts/ — SAME payload as a level start; the
 * existing answers/complete endpoints then drive the whole session.
 */
export function useStartChallengeAttempt() {
  return useMutation({
    mutationFn: async (challengeId: number) =>
      (await api.post<StartAttemptResponse>(ENDPOINTS.challengeAttempts(challengeId), {})).data,
  });
}
