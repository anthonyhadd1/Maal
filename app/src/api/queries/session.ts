import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import { queryClient } from '@/api/queryClient';
import type {
  AnswerPayload,
  AnswerResponse,
  AttemptDetailResponse,
  CompleteResponse,
  PracticeMistakesPreview,
  StartAttemptResponse,
} from '@/api/types';
import { useAuthStore } from '@/stores/authStore';

/**
 * Attempt trio + abandon (PLAN reconciled decision 1) — server-authoritative
 * per-question grading. The client NEVER computes correctness or XP; it only
 * mirrors server responses. Combo is therefore reconciled from each answer
 * response rather than bumped optimistically (correctness is unknowable
 * client-side — correct answers are never shipped to the app).
 */

/** number = plain start (back-compat); object form opts into legendary mode. */
export type StartAttemptInput = number | { levelId: number; legendary?: boolean };

export function useStartAttempt() {
  return useMutation({
    mutationFn: async (input: StartAttemptInput) => {
      const levelId = typeof input === 'number' ? input : input.levelId;
      const legendary = typeof input === 'number' ? false : (input.legendary ?? false);
      return (
        await api.post<StartAttemptResponse>(
          ENDPOINTS.levelAttempts(levelId),
          legendary ? { legendary: true } : {},
        )
      ).data;
    },
  });
}

/** GET /attempts/{id}/ — resume payload (questions + answered verdicts). */
export function useAttemptDetail(attemptId: number | null) {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: ['attempts', 'detail', attemptId ?? -1] as const,
    queryFn: async () =>
      (await api.get<AttemptDetailResponse>(ENDPOINTS.attemptDetail(attemptId!))).data,
    staleTime: 0,
    enabled: status === 'authed' && attemptId != null,
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

/** GET /practice/mistakes/ — due-item counter + truncated preview (no answers). */
export function usePracticeMistakes() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: keys.practiceMistakes,
    queryFn: async () =>
      (await api.get<PracticeMistakesPreview>(ENDPOINTS.practiceMistakes)).data,
    enabled: status === 'authed',
  });
}

/** POST /practice/attempts/ — same {attempt_id, questions[]} shape as a level start. */
export function useStartPracticeAttempt() {
  return useMutation({
    mutationFn: async () =>
      (await api.post<StartAttemptResponse>(ENDPOINTS.practiceAttempts, {})).data,
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
