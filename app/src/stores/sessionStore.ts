import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  AnswerResponse,
  AttemptQuestion,
  CompleteResponse,
  ExplanationMediaType,
} from '@/api/types';

/**
 * In-session game state (design_mobile.md §5/§10 + PLAN decision 1/4).
 *
 * Persisted to AsyncStorage on every answer for CRASH RECOVERY: if the app
 * dies mid-level, the map screen offers « Reprendre ta partie ? » as long as
 * the attempt is < 30 min old (the server keeps attempts alive that long).
 *
 * Invariants:
 * - NO re-queue: each question is answered exactly once, ever.
 * - Navigation between questions is FREE (swipe-card pager) — `currentIndex`
 *   is just "which card the pager last showed", restored on resume, and can
 *   move in either direction. It gates nothing.
 * - Correctness/combo/hearts are server verdicts mirrored from the answer
 *   response — never computed locally.
 */

export const SESSION_RESUME_WINDOW_MS = 30 * 60 * 1000;

export type SessionStatus = 'idle' | 'inProgress' | 'completed';

/**
 * The full server verdict for one question, persisted so ANY card — not just
 * the one just answered — can render its own reveal colors + explanation
 * when the player swipes back to review it.
 */
export interface SessionAnswerRecord {
  selected: number[];
  is_correct: boolean;
  correct_choice_ids: number[];
  explanation_text: string | null;
  explanation_media_url: string | null;
  explanation_media_type: ExplanationMediaType | null;
}

interface SessionStateData {
  attemptId: number | null;
  /** null for practice attempts (level=None server-side — no fixed level). */
  levelId: number | null;
  /** Non-null when this attempt was started from a friend challenge. */
  challengeId: number | null;
  /** True for spaced-repetition mistake-review attempts (no stars/pass-fail). */
  isPractice: boolean;
  /** True for legendary runs (≥9/10, explanations withheld, gold chrome). */
  legendary: boolean;
  questions: AttemptQuestion[];
  /** Which card the pager last showed — free navigation, restored on resume. */
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
    /** null for practice attempts (level=None server-side). */
    levelId: number | null;
    questions: AttemptQuestion[];
    /** Friend-challenge attempts carry the challenge id (default null). */
    challengeId?: number | null;
    /** Legendary-mode attempts flag the whole session (default false). */
    legendary?: boolean;
    /** Spaced-repetition mistake-review attempt (default false). */
    isPractice?: boolean;
  }) => void;
  /** Records ONE server verdict. Ignores duplicates (no re-answer, no re-queue). */
  recordAnswer: (questionId: number, selected: number[], response: AnswerResponse) => void;
  /** Pager reports whichever card is focused — free navigation, either direction. */
  setViewedIndex: (index: number) => void;
  setResults: (results: CompleteResponse) => void;
  reset: () => void;
  setHasHydrated: (value: boolean) => void;
}

export type SessionState = SessionStateData & SessionStateActions;

const INITIAL: Omit<SessionStateData, 'hasHydrated'> = {
  attemptId: null,
  levelId: null,
  challengeId: null,
  isPractice: false,
  legendary: false,
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

      startSession: ({
        attemptId,
        levelId,
        questions,
        challengeId = null,
        legendary = false,
        isPractice = false,
      }) =>
        set({
          ...INITIAL,
          attemptId,
          levelId,
          challengeId,
          isPractice,
          legendary,
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
            [questionId]: {
              selected,
              is_correct: response.is_correct,
              correct_choice_ids: response.correct_choice_ids,
              explanation_text: response.explanation_text,
              explanation_media_url: response.explanation_media_url,
              explanation_media_type: response.explanation_media_type,
            },
          },
          combo: response.combo,
          maxCombo: Math.max(state.maxCombo, response.combo),
          heartsRemaining: response.hearts_remaining,
          heartsUnlimited: response.hearts_unlimited,
        });
      },

      setViewedIndex: (index) => {
        const state = get();
        if (state.status !== 'inProgress') return;
        if (index < 0 || index > state.questions.length - 1) return;
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
