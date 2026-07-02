import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AnswerResponse, AttemptQuestion, CompleteResponse } from '@/api/types';

/**
 * In-session game state (design_mobile.md §5/§10 + PLAN decision 1/4).
 *
 * Persisted to AsyncStorage on every answer for CRASH RECOVERY: if the app
 * dies mid-level, the map screen offers « Reprendre ta partie ? » as long as
 * the attempt is < 30 min old (the server keeps attempts alive that long).
 *
 * Invariants:
 * - NO re-queue (PLAN decision 4): each question is answered exactly once,
 *   `currentIndex` only ever moves forward.
 * - Correctness/combo/hearts are server verdicts mirrored from the answer
 *   response — never computed locally.
 */

export const SESSION_RESUME_WINDOW_MS = 30 * 60 * 1000;

export type SessionStatus = 'idle' | 'inProgress' | 'completed';

export interface SessionAnswerRecord {
  selected: number[];
  is_correct: boolean;
}

interface SessionStateData {
  attemptId: number | null;
  levelId: number | null;
  /** Non-null when this attempt was started from a friend challenge. */
  challengeId: number | null;
  questions: AttemptQuestion[];
  /** Index of the question currently on screen (forward-only). */
  currentIndex: number;
  /** questionId -> verdict. A key present here can never be re-answered. */
  answers: Record<number, SessionAnswerRecord>;
  /** Server-authoritative consecutive-correct counter. */
  combo: number;
  maxCombo: number;
  heartsRemaining: number | null;
  heartsUnlimited: boolean;
  /** Epoch ms — drives the 30 min crash-recovery window. */
  startedAt: number | null;
  /** Epoch ms when the attempt was completed (results « temps » stat). */
  completedAt: number | null;
  status: SessionStatus;
  /** Completion payload for the results screen (not persisted). */
  results: CompleteResponse | null;
  /** True once AsyncStorage rehydration finished (gates the resume modal). */
  hasHydrated: boolean;
}

interface SessionStateActions {
  startSession: (payload: {
    attemptId: number;
    levelId: number;
    questions: AttemptQuestion[];
    /** Friend-challenge attempts carry the challenge id (default null). */
    challengeId?: number | null;
  }) => void;
  /** Records ONE server verdict. Ignores duplicates (no re-answer, no re-queue). */
  recordAnswer: (questionId: number, selected: number[], response: AnswerResponse) => void;
  /** Move to the next question (forward-only). */
  advance: () => void;
  /** Jump forward to an index (crash-recovery resume). Never moves backward. */
  advanceTo: (index: number) => void;
  setResults: (results: CompleteResponse) => void;
  reset: () => void;
  setHasHydrated: (value: boolean) => void;
}

export type SessionState = SessionStateData & SessionStateActions;

const INITIAL: Omit<SessionStateData, 'hasHydrated'> = {
  attemptId: null,
  levelId: null,
  challengeId: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  combo: 0,
  maxCombo: 0,
  heartsRemaining: null,
  heartsUnlimited: false,
  startedAt: null,
  completedAt: null,
  status: 'idle',
  results: null,
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      hasHydrated: false,

      startSession: ({ attemptId, levelId, questions, challengeId = null }) =>
        set({
          ...INITIAL,
          attemptId,
          levelId,
          challengeId,
          questions,
          startedAt: Date.now(),
          status: 'inProgress',
        }),

      recordAnswer: (questionId, selected, response) => {
        const state = get();
        if (state.status !== 'inProgress') return;
        if (state.answers[questionId]) return; // answered once, forever (no re-queue)
        set({
          answers: {
            ...state.answers,
            [questionId]: { selected, is_correct: response.is_correct },
          },
          combo: response.combo,
          maxCombo: Math.max(state.maxCombo, response.combo),
          heartsRemaining: response.hearts_remaining,
          heartsUnlimited: response.hearts_unlimited,
        });
      },

      advance: () => {
        const state = get();
        if (state.status !== 'inProgress') return;
        if (state.currentIndex >= state.questions.length - 1) return;
        set({ currentIndex: state.currentIndex + 1 });
      },

      advanceTo: (index) => {
        const state = get();
        if (state.status !== 'inProgress') return;
        if (index <= state.currentIndex || index > state.questions.length - 1) return;
        set({ currentIndex: index });
      },

      setResults: (results) => set({ results, status: 'completed', completedAt: Date.now() }),

      reset: () => set({ ...INITIAL }),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'ace.session',
      storage: createJSONStorage(() => AsyncStorage),
      // Results are transient (re-fetched implicitly via invalidations); the
      // hydration flag is runtime-only.
      partialize: ({ results: _results, hasHydrated: _hasHydrated, ...data }) => data,
      onRehydrateStorage: () => () => {
        useSessionStore.getState().setHasHydrated(true);
      },
    },
  ),
);

/** True when a persisted attempt is recent enough to offer « Reprendre ». */
export function isSessionResumable(
  state: Pick<SessionStateData, 'status' | 'startedAt' | 'attemptId'>,
  now: number = Date.now(),
): boolean {
  return (
    state.status === 'inProgress' &&
    state.attemptId != null &&
    state.startedAt != null &&
    now - state.startedAt < SESSION_RESUME_WINDOW_MS
  );
}
