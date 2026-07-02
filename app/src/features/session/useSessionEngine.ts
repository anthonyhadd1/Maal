import { useCallback, useEffect, useRef, useState } from 'react';

import { parseApiError, type ApiErrorInfo } from '@/api/errors';
import { useStartChallengeAttempt } from '@/api/queries/challenges';
import {
  useAbandonAttempt,
  useCompleteAttempt,
  useStartAttempt,
  useSubmitAnswer,
} from '@/api/queries/session';
import type { AnswerResponse, StartAttemptResponse } from '@/api/types';
import { notifyError, notifySuccess } from '@/lib/haptics';
import { useSessionStore } from '@/stores/sessionStore';

/**
 * Session state machine (design_mobile.md §4b + PLAN decisions 1/4):
 *
 *   loading → question(idle) → submitting → feedback(correct|wrong)
 *       → next question | completing → done (results ready)
 *
 * - NO wrong-answer re-queue: every question is answered exactly once.
 * - Grading/hearts/combo are server verdicts, mirrored from responses.
 * - All durable state lives in sessionStore (persisted → crash recovery);
 *   the engine holds only the ephemeral phase + last verdict.
 * - Navigation is NOT performed here — screens react to `phase`.
 */

export type SessionPhase =
  | 'loading'
  | 'question'
  | 'submitting'
  | 'feedback'
  | 'completing'
  | 'done'
  | 'error';

export interface SessionEngineCallbacks {
  /** Hearts just hit 0 mid-session (non-blocking — the attempt continues). */
  onHeartsDepleted?: () => void;
  /** An answer/complete call failed (network/server) — show a toast. */
  onRequestError?: (info: ApiErrorInfo) => void;
}

export interface SessionEngineOptions {
  /**
   * Start source: when set, the attempt is created via
   * POST /challenges/{id}/attempts/ instead of the level start — everything
   * downstream (answers/complete) is identical.
   */
  challengeId?: number | null;
}

export function useSessionEngine(
  levelId: number,
  callbacks: SessionEngineCallbacks = {},
  options: SessionEngineOptions = {},
) {
  const challengeId = options.challengeId ?? null;
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [lastAnswer, setLastAnswer] = useState<AnswerResponse | null>(null);
  const [startError, setStartError] = useState<ApiErrorInfo | null>(null);

  const attemptId = useSessionStore((s) => s.attemptId);
  const questions = useSessionStore((s) => s.questions);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  const answers = useSessionStore((s) => s.answers);
  const combo = useSessionStore((s) => s.combo);
  const heartsRemaining = useSessionStore((s) => s.heartsRemaining);
  const heartsUnlimited = useSessionStore((s) => s.heartsUnlimited);

  const startAttempt = useStartAttempt();
  const startChallengeAttempt = useStartChallengeAttempt();
  const submitAnswer = useSubmitAnswer(attemptId);
  const completeAttempt = useCompleteAttempt();
  const abandonAttempt = useAbandonAttempt();

  /** Per-question display timestamp -> time_ms in the answer payload. */
  const shownAtRef = useRef<number>(Date.now());
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const complete = useCallback(
    (id: number) => {
      setPhase('completing');
      completeAttempt.mutate(id, {
        onSuccess: (results) => {
          useSessionStore.getState().setResults(results);
          setPhase('done');
        },
        onError: (error) => {
          const info = parseApiError(error);
          setStartError(info);
          setPhase('error');
          callbacksRef.current.onRequestError?.(info);
        },
      });
    },
    [completeAttempt],
  );

  /** Resume from the (persisted or freshly seeded) store. */
  const enterFromStore = useCallback(() => {
    const s = useSessionStore.getState();
    if (s.attemptId == null || s.questions.length === 0) return false;
    const firstUnanswered = s.questions.findIndex((q) => !s.answers[q.id]);
    if (firstUnanswered === -1) {
      // Crashed between last answer and completion — finish now.
      complete(s.attemptId);
      return true;
    }
    if (firstUnanswered !== s.currentIndex) {
      s.advanceTo(firstUnanswered);
    }
    shownAtRef.current = Date.now();
    setPhase('question');
    return true;
  }, [complete]);

  const initialize = useCallback(() => {
    setStartError(null);
    const s = useSessionStore.getState();
    const matchesStore =
      s.status === 'inProgress' &&
      s.levelId === levelId &&
      s.attemptId != null &&
      s.challengeId === challengeId;
    if (matchesStore && enterFromStore()) return;

    setPhase('loading');
    const onSuccess = (data: StartAttemptResponse) => {
      useSessionStore.getState().startSession({
        attemptId: data.attempt_id,
        levelId,
        questions: data.questions,
        challengeId,
      });
      shownAtRef.current = Date.now();
      setPhase('question');
    };
    const onError = (error: unknown) => {
      const info = parseApiError(error);
      setStartError(info);
      setPhase('error');
    };
    if (challengeId != null) {
      startChallengeAttempt.mutate(challengeId, { onSuccess, onError });
    } else {
      startAttempt.mutate(levelId, { onSuccess, onError });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId, challengeId, enterFromStore]);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initialize();
  }, [initialize]);

  // « Rejouer »: a new attempt seeded into the store while mounted → re-enter
  // (the results screen pops back to this one). Reset-to-null is ignored.
  const prevAttemptRef = useRef(attemptId);
  useEffect(() => {
    if (prevAttemptRef.current === attemptId) return;
    prevAttemptRef.current = attemptId;
    if (attemptId != null) {
      setLastAnswer(null);
      setStartError(null);
      enterFromStore();
    }
  }, [attemptId, enterFromStore]);

  const submit = useCallback(
    (selectedChoiceIds: number[]) => {
      if (phase !== 'question' || selectedChoiceIds.length === 0) return;
      const store = useSessionStore.getState();
      const question = store.questions[store.currentIndex];
      if (!question || store.answers[question.id]) return; // answered once, forever

      setPhase('submitting');
      const timeMs = Math.max(0, Date.now() - shownAtRef.current);
      submitAnswer.mutate(
        { question_id: question.id, selected_choice_ids: selectedChoiceIds, time_ms: timeMs },
        {
          onSuccess: (response) => {
            const prevHearts = useSessionStore.getState().heartsRemaining;
            useSessionStore.getState().recordAnswer(question.id, selectedChoiceIds, response);
            setLastAnswer(response);
            setPhase('feedback');
            if (response.is_correct) notifySuccess();
            else notifyError();
            if (
              !response.hearts_unlimited &&
              response.hearts_remaining === 0 &&
              (prevHearts == null || prevHearts > 0)
            ) {
              callbacksRef.current.onHeartsDepleted?.();
            }
          },
          onError: (error) => {
            setPhase('question');
            callbacksRef.current.onRequestError?.(parseApiError(error));
          },
        },
      );
    },
    [phase, submitAnswer],
  );

  const continueNext = useCallback(() => {
    if (phase !== 'feedback') return;
    const store = useSessionStore.getState();
    setLastAnswer(null);
    if (store.currentIndex >= store.questions.length - 1) {
      if (store.attemptId != null) complete(store.attemptId);
    } else {
      store.advance();
      shownAtRef.current = Date.now();
      setPhase('question');
    }
  }, [phase, complete]);

  /** Retry the failed stage (start / complete). */
  const retry = useCallback(() => {
    initialized.current = true;
    initialize();
  }, [initialize]);

  /** Quit-confirm accepted: abandon server-side (fire and forget) + clear. */
  const abandon = useCallback(() => {
    const store = useSessionStore.getState();
    if (store.attemptId != null) {
      abandonAttempt.mutate(store.attemptId);
    }
    store.reset();
  }, [abandonAttempt]);

  const question = questions[currentIndex] ?? null;
  const answeredCount = Object.keys(answers).length;

  return {
    phase,
    question,
    currentIndex,
    total: questions.length,
    answeredCount,
    combo,
    heartsRemaining,
    heartsUnlimited,
    lastAnswer,
    startError,
    isSubmitting: phase === 'submitting',
    submit,
    continueNext,
    retry,
    abandon,
  };
}

export type SessionEngine = ReturnType<typeof useSessionEngine>;
