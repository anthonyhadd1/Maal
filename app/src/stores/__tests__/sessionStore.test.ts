import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isSessionResumable,
  SESSION_RESUME_WINDOW_MS,
  useSessionStore,
} from '@/stores/sessionStore';
import {
  ATTEMPT_ID,
  correctAnswer,
  LEVEL_ID,
  startAttemptResponse,
  wrongAnswer,
} from '@/test/fixtures/session';

function seedSession() {
  useSessionStore.getState().startSession({
    attemptId: ATTEMPT_ID,
    levelId: LEVEL_ID,
    questions: startAttemptResponse.questions,
  });
}

describe('sessionStore', () => {
  beforeEach(async () => {
    useSessionStore.getState().reset();
    await AsyncStorage.clear();
  });

  test('startSession seeds a fresh in-progress attempt', () => {
    seedSession();
    const s = useSessionStore.getState();
    expect(s.attemptId).toBe(ATTEMPT_ID);
    expect(s.levelId).toBe(LEVEL_ID);
    expect(s.questions).toHaveLength(3);
    expect(s.currentIndex).toBe(0);
    expect(s.answers).toEqual({});
    expect(s.combo).toBe(0);
    expect(s.status).toBe('inProgress');
    expect(s.startedAt).not.toBeNull();
  });

  test('recordAnswer mirrors the server verdict (combo, hearts, answers map)', () => {
    seedSession();
    useSessionStore.getState().recordAnswer(101, [1], correctAnswer({ combo: 1 }));

    const s = useSessionStore.getState();
    expect(s.answers[101]).toEqual({ selected: [1], is_correct: true });
    expect(s.combo).toBe(1);
    expect(s.maxCombo).toBe(1);
    expect(s.heartsRemaining).toBe(5);
    expect(s.heartsUnlimited).toBe(false);
  });

  test('combo resets on a wrong verdict but maxCombo is retained', () => {
    seedSession();
    const store = useSessionStore.getState();
    store.recordAnswer(101, [1], correctAnswer({ combo: 1 }));
    store.recordAnswer(102, [4, 6], correctAnswer({ combo: 2 }));
    store.recordAnswer(103, [9], wrongAnswer({ combo: 0, hearts_remaining: 4 }));

    const s = useSessionStore.getState();
    expect(s.combo).toBe(0);
    expect(s.maxCombo).toBe(2);
    expect(s.heartsRemaining).toBe(4);
  });

  test('NO RE-QUEUE: an answered question can never be answered again', () => {
    seedSession();
    const store = useSessionStore.getState();
    store.recordAnswer(101, [2], wrongAnswer({ combo: 0 }));

    // A second verdict for the same question is ignored entirely.
    store.recordAnswer(101, [1], correctAnswer({ combo: 5, hearts_remaining: 5 }));

    const s = useSessionStore.getState();
    expect(s.answers[101]).toEqual({ selected: [2], is_correct: false });
    expect(s.combo).toBe(0);
    expect(Object.keys(s.answers)).toHaveLength(1);
  });

  test('advance is forward-only and clamped to the last question', () => {
    seedSession();
    const store = useSessionStore.getState();
    store.advance();
    expect(useSessionStore.getState().currentIndex).toBe(1);
    store.advance();
    expect(useSessionStore.getState().currentIndex).toBe(2);
    store.advance(); // clamped
    expect(useSessionStore.getState().currentIndex).toBe(2);
  });

  test('advanceTo jumps forward (crash resume) but never backward', () => {
    seedSession();
    const store = useSessionStore.getState();
    store.advanceTo(2);
    expect(useSessionStore.getState().currentIndex).toBe(2);
    store.advanceTo(0);
    expect(useSessionStore.getState().currentIndex).toBe(2);
    store.advanceTo(99);
    expect(useSessionStore.getState().currentIndex).toBe(2);
  });

  test('a full no-requeue walk visits each question exactly once', () => {
    seedSession();
    const store = useSessionStore.getState();
    const visited: number[] = [];

    for (;;) {
      const s = useSessionStore.getState();
      const question = s.questions[s.currentIndex];
      expect(visited).not.toContain(question.id); // never re-shown
      visited.push(question.id);
      s.recordAnswer(question.id, [question.choices[0].id], wrongAnswer({ combo: 0 }));
      if (s.currentIndex >= s.questions.length - 1) break;
      store.advance();
    }

    expect(visited).toEqual([101, 102, 103]);
    expect(Object.keys(useSessionStore.getState().answers)).toHaveLength(3);
  });

  test('setResults closes the attempt and stamps completedAt', () => {
    seedSession();
    useSessionStore.getState().setResults({
      score_pct: 100,
      correct_count: 3,
      total_count: 3,
      stars: 3,
      passed: true,
      xp: { base: 6, perfect_bonus: 10, first_clear_bonus: 10, total: 26 },
      hearts: { lost: 0, remaining: 5, next_heart_at: null },
      streak: { current: 1, extended_today: true },
      unlocked_level_id: 8,
      achievements_unlocked: [],
      review: [],
    });

    const s = useSessionStore.getState();
    expect(s.status).toBe('completed');
    expect(s.results?.stars).toBe(3);
    expect(s.completedAt).not.toBeNull();
  });

  test('crash-recovery rehydration restores the persisted attempt at currentIndex', async () => {
    seedSession();
    const store = useSessionStore.getState();
    store.recordAnswer(101, [1], correctAnswer({ combo: 1 }));
    store.advance();

    // Wait for zustand/persist to flush to AsyncStorage.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const persisted = await AsyncStorage.getItem('ace.session');
    expect(persisted).toBeTruthy();

    // Simulate an app relaunch: wipe memory state (the wipe itself persists,
    // so restore the on-disk snapshot as it would exist after a crash), then
    // rehydrate from storage.
    useSessionStore.setState({
      attemptId: null,
      levelId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      combo: 0,
      maxCombo: 0,
      status: 'idle',
      startedAt: null,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await AsyncStorage.setItem('ace.session', persisted!);
    await useSessionStore.persist.rehydrate();

    const s = useSessionStore.getState();
    expect(s.attemptId).toBe(ATTEMPT_ID);
    expect(s.levelId).toBe(LEVEL_ID);
    expect(s.status).toBe('inProgress');
    expect(s.currentIndex).toBe(1); // resumed where we crashed
    expect(s.answers[101]).toEqual({ selected: [1], is_correct: true });
    expect(s.questions).toHaveLength(3);
    expect(isSessionResumable(s)).toBe(true);
  });

  test('legendary flag: default false, set by startSession, cleared by reset', async () => {
    seedSession();
    expect(useSessionStore.getState().legendary).toBe(false);

    useSessionStore.getState().startSession({
      attemptId: ATTEMPT_ID + 1,
      levelId: LEVEL_ID,
      questions: startAttemptResponse.questions,
      legendary: true,
    });
    expect(useSessionStore.getState().legendary).toBe(true);

    // Persisted for crash recovery (gold banner + withheld explanations
    // survive a relaunch mid-run).
    await new Promise((resolve) => setTimeout(resolve, 0));
    const persisted = JSON.parse((await AsyncStorage.getItem('ace.session'))!) as {
      state: { legendary: boolean };
    };
    expect(persisted.state.legendary).toBe(true);

    useSessionStore.getState().reset();
    expect(useSessionStore.getState().legendary).toBe(false);
  });

  test('a legendary run still records verdicts and results like a plain one', () => {
    useSessionStore.getState().startSession({
      attemptId: ATTEMPT_ID,
      levelId: LEVEL_ID,
      questions: startAttemptResponse.questions,
      legendary: true,
    });
    const store = useSessionStore.getState();
    store.recordAnswer(101, [1], correctAnswer({ combo: 1, explanation_text: null }));

    const s = useSessionStore.getState();
    expect(s.legendary).toBe(true);
    expect(s.answers[101]).toEqual({ selected: [1], is_correct: true });
    expect(s.challengeId).toBeNull();
  });

  test('isSessionResumable respects the 30 min window and status', () => {
    const now = Date.now();
    const base = { status: 'inProgress' as const, attemptId: 1, startedAt: now - 60_000 };
    expect(isSessionResumable(base, now)).toBe(true);
    expect(
      isSessionResumable({ ...base, startedAt: now - SESSION_RESUME_WINDOW_MS - 1 }, now),
    ).toBe(false);
    expect(isSessionResumable({ ...base, status: 'completed' }, now)).toBe(false);
    expect(isSessionResumable({ ...base, status: 'idle' }, now)).toBe(false);
    expect(isSessionResumable({ ...base, attemptId: null }, now)).toBe(false);
  });
});
