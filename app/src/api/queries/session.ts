import { useMutation } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import { queryClient } from '@/api/queryClient';
import type {
  AnswerPayload,
  AnswerResponse,
  CompleteResponse,
  StartAttemptResponse,
} from '@/api/types';

/**
 * Attempt trio + abandon (PLAN reconciled decision 1) — server-authoritative
 * per-question grading. The client NEVER computes correctness or XP; it only
 * mirrors server responses. Combo is therefore reconciled from each answer
 * response rather than bumped optimistically (correctness is unknowable
 * client-side — correct answers are never shipped to the app).
 */

export function useStartAttempt() {
  return useMutation({
    mutationFn: async (levelId: number) =>
      (await api.post<StartAttemptResponse>(ENDPOINTS.levelAttempts(levelId), {})).data,
  });
}

export function useSubmitAnswer(attemptId: number | null) {
  return useMutation({
    mutationFn: async (payload: AnswerPayload) => {
      if (attemptId == null) throw new Error('No active attempt');
      return (await api.post<AnswerResponse>(ENDPOINTS.attemptAnswers(attemptId), payload)).data;
    },
    onSuccess: (data) => {
      // Keep the header hearts in sync without waiting for a refetch.
      queryClient.setQueryData(keys.game, (old: unknown) =>
        old && typeof old === 'object'
          ? {
              ...old,
              hearts: data.hearts_remaining,
              hearts_unlimited: data.hearts_unlimited,
              next_heart_at: data.next_heart_at,
            }
          : old,
      );
    },
  });
}

export function useCompleteAttempt() {
  return useMutation({
    mutationFn: async (attemptId: number) =>
      (await api.post<CompleteResponse>(ENDPOINTS.attemptComplete(attemptId), {})).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.game }),
        queryClient.invalidateQueries({ queryKey: keys.mapRoot }),
      ]);
    },
  });
}

export function useAbandonAttempt() {
  return useMutation({
    mutationFn: async (attemptId: number) =>
      (await api.post(ENDPOINTS.attemptAbandon(attemptId), {})).data,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.game });
    },
  });
}
