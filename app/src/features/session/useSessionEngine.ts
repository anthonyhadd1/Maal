import { useCallback, useEffect, useRef, useState } from 'react';

import { parseApiError, type ApiErrorInfo } from '@/api/errors';
import { useStartChallengeAttempt } from '@/api/queries/challenges';
import {
  useAbandonAttempt,
  useCompleteAttempt,
  useStartAttempt,
  useStartPracticeAttempt,
  useSubmitAnswer,
} from '@/api/queries/session';
import type { AttemptQuestion, StartAttemptResponse } from '@/api/types';
import { notifyError, notifySuccess } from '@/lib/haptics';
import { play } from '@/lib/sounds';
import { useSessionStore } from '@/stores/sessionStore';

/** Combo run lengths that get the escalating combo flourish (design §4b). */
export const COMBO_SOUND_STEPS = [3, 5, 8] as const;

/**
 * Session state machine (swipe-card pager — free navigation):
 *
 *   loading → question → completing → done (results ready)
 *
 * - NO wrong-answer re-queue: every question is answered exactly once, in
 *   WHATEVER ORDER the player swipes to it. The server doesn't enforce order
 *   either (submit_answer only checks attempt membership + "not already
 *   answered") — so this is a pure client-side navigation freedom, not a
 *   relaxation of any server contract.
 * - Any card can be viewed at any time; only one submission is ever in
 *   flight (`submittingId`), and at most one card's feedback overlay is open
 *   at a time (`justAnsweredId`) — a human can only tap one button at once.
 * - All durable state lives in sessionStore (persisted → crash recovery);
 *   the engine holds only the ephemeral phase + in-flight/just-answered ids.
 */

export type SessionPhase = 'loading' | 'question' | 'completing' | 'done' | 'error';

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
  /**
   * Start source: when true, the attempt is created via
   * POST /practice/attempts/ (spaced-repetition mistake review) instead of
   * the level start — `levelId` is ignored/null in this mode. Everything
   * downstream (answers/complete) is identical; complete() returns
   * stars/passed = null (no pass-fail framing for a review run).
   */
  practice?: boolean;
}

export function useSessionEngine(
  levelId: number | null,
  callbacks: SessionEngineCallbacks = {},
  options: SessionEngineOptions = {},
) {
  const challengeId = options.challengeId ?? null;
  const practice = options.practice ?? false;
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [justAnsweredId, setJustAnsweredId] = useState<number | null>(null);
  const [startError, setStartError] = useState<ApiErrorInfo | null>(null);

  const attemptId = useSessionStore((s) => s.attemptId);
  const questions = useSessionStore((s) => s.questions);
  const viewedIndex = useSessionStore((s) => s.currentIndex);
  const answers = useSessionStore((s) => s.answers);
  const combo = useSessionStore((s) => s.combo);
  const heartsRemaining = useSessionStore((s) => s.heartsRemaining);
  const heartsUnlimited = useSessionStore((s) => s.heartsUnlimited);
  const setViewedIndexStore = useSessionStore((s) => s.setViewedIndex);

  const startAttempt = useStartAttempt();
  const startChallengeAttempt = useStartChallengeAttempt();
  const startPracticeAttempt = useStartPracticeAttempt();
  const submitAnswer = useSubmitAnswer(attemptId);
  const completeAttempt = useCompleteAttempt();
  const abandonAttempt = useAbandonAttempt();

  /** Per-question "first seen" timestamp -> time_ms in the answer payload. */
  const shownAtRef = useRef<Map<number, number>>(new Map());
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const completingRef = useRef(false); // guards firing complete() twice
  // Synchronous guard: `submittingId` (React state) is batched, so two
  // submit() calls fired in the same tick would both still see the stale
  // pre-update value. A ref reads/writes immediately, closing that race.
  const submittingRef = useRef<number | null>(null);

  const complete = useCallback(
    (id: number) => {
      completingRef.current = true;
      setPhase('completing');
      completeAttempt.mutate(id, {
        onSuccess: (results) => {
          useSessionStore.getState().setResults(results);
          setPhase('done');
        },
        onError: (error) => {
          completingRef.current = false;
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
      s.setViewedIndex(firstUnanswered);
    }
    setPhase('question');
    return true;
  }, [complete]);

  const initialize = useCallback(() => {
    setStartError(null);
    const s = useSessionStore.getState();
    const matchesStore =
      s.status === 'inProgress' &&
      s.isPractice === practice &&
      s.levelId === levelId &&
      s.attemptId != null &&
      s.challengeId === challengeId;
    if (matchesStore && enterFromStore()) return;

    setPhase('loading');
    const onSuccess = (data: StartAttemptResponse) => {
      useSessionStore.getState().startSession({
        attemptId: data.attempt_id,
        levelId: practice ? null : levelId,
        questions: data.questions,
        challengeId,
        isPractice: practice,
      });
      setPhase('question');
    };
    const onError = (error: unknown) => {
      const info = parseApiError(error);
      setStartError(info);
      setPhase('error');
    };
    if (practice) {
      startPracticeAttempt.mutate(undefined, { onSuccess, onError });
    } else if (challengeId != null) {
      startChallengeAttempt.mutate(challengeId, { onSuccess, onError });
    } else {
      startAttempt.mutate(levelId!, { onSuccess, onError });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId, challengeId, practice, enterFromStore]);

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
      setJustAnsweredId(null);
      setSubmittingId(null);
      setStartError(null);
      shownAtRef.current = new Map();
      completingRef.current = false;
      submittingRef.current = null;
      enterFromStore();
    }
  }, [attemptId, enterFromStore]);

  // All questions answered → complete automatically, regardless of which
  // card (or order) supplied the last verdict. Guarded by `completingRef` so
  // a re-render mid-flight never double-fires the request.
  useEffect(() => {
    if (phase !== 'question') return;
    if (questions.length === 0 || attemptId == null) return;
    if (completingRef.current) return;
    if (Object.keys(answers).length < questions.length) return;
    complete(attemptId);
  }, [phase, questions.length, answers, attemptId, complete]);

  /** First render of a card marks its "shown" timestamp for time_ms. Idempotent. */
  const markShown = useCallback((questionId: number) => {
    if (!shownAtRef.current.has(questionId)) {
      shownAtRef.current.set(questionId, Date.now());
    }
  }, []);

  const setViewedIndex = useCallback(
    (index: number) => setViewedIndexStore(index),
    [setViewedIndexStore],
  );

  const submit = useCallback(
    (question: AttemptQuestion, selectedChoiceIds: number[]) => {
      if (phase !== 'question' || selectedChoiceIds.length === 0) return;
      if (submittingRef.current != null) return; // one in flight at a time
      if (useSessionStore.getState().answers[question.id]) return; // answered once, forever

      submittingRef.current = question.id;
      setSubmittingId(question.id);
      const shownAt = shownAtRef.current.get(question.id) ?? Date.now();
      const timeMs = Math.max(0, Date.now() - shownAt);
      submitAnswer.mutate(
        { question_id: question.id, selected_choice_ids: selectedChoiceIds, time_ms: timeMs },
        {
          onSuccess: (response) => {
            const prevHearts = useSessionStore.getState().heartsRemaining;
            useSessionStore.getState().recordAnswer(question.id, selectedChoiceIds, response);
            submittingRef.current = null;
            setSubmittingId(null);
            setJustAnsweredId(question.id);
            if (response.is_correct) {
              notifySuccess();
              play('correct');
              // Combo flourish lands on top of the correct blip at 3/5/8.
              if ((COMBO_SOUND_STEPS as readonly number[]).includes(response.combo)) {
                play('combo');
              }
            } else {
              notifyError();
              play('wrong');
            }
            if (
              !response.hearts_unlimited &&
              response.hearts_remaining === 0 &&
              (prevHearts == null || prevHearts > 0)
            ) {
              callbacksRef.current.onHeartsDepleted?.();
            }
          },
          onError: (error) => {
            submittingRef.current = null;
            setSubmittingId(null);
            callbacksRef.current.onRequestError?.(parseApiError(error));
          },
        },
      );
    },
    [phase, submitAnswer],
  );

  /** Closes the just-answered card's feedback overlay. */
  const dismissFeedback = useCallback(() => {
    setJustAnsweredId(null);
  }, []);

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

  const question = questions[viewedIndex] ?? null;
  const answeredCount = Object.keys(answers).length;

  return {
    phase,
    questions,
    answers,
    question,
    viewedIndex,
    setViewedIndex,
    total: questions.length,
    answeredCount,
    combo,
    heartsRemaining,
    heartsUnlimited,
    submittingId,
    justAnsweredId,
    startError,
    markShown,
    submit,
    dismissFeedback,
    retry,
    abandon,
  };
}

export type SessionEngine = ReturnType<typeof useSessionEngine>;
