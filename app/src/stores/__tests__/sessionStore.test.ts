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
    expect(s.answers[101]).toEqual({
      selected: [1],
      is_correct: true,
      correct_choice_ids: [1],
      explanation_text: '$M = 2(1) + 32 + 4(16) = 98$ g/mol.',
      explanation_media_url: null,
      explanation_media_type: null,
    });
    expect(s.combo).toBe(1);
    expect(s.maxCombo).toBe(1);
    expect(s.heartsRemaining).toBe(5);
    expect(s.heartsUnlimited).toBe(false);
  });

  test('recordAnswer persists the FULL verdict — a revisited card can render its own review without a live "lastAnswer" pointer', () => {
    seedSession();
    const store = useSessionStore.getState();
    store.recordAnswer(101, [1], correctAnswer({ combo: 1 }));
    store.recordAnswer(102, [5], wrongAnswer({ combo: 0, explanation_text: 'Non — acide faible.' }));

    const s = useSessionStore.getState();
    expect(s.answers[101].correct_choice_ids).toEqual([1]);
    expect(s.answers[102].explanation_text).toBe('Non — acide faible.');
    expect(s.answers[102].is_correct).toBe(false);
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
    expect(s.answers[101].selected).toEqual([2]);
    expect(s.answers[101].is_correct).toBe(false);
    expect(s.combo).toBe(0);
    expect(Object.keys(s.answers)).toHaveLength(1);
  });

  test('setViewedIndex moves freely in either direction — navigation is not gated', () => {
    seedSession();
    const store = useSessionStore.getState();
    store.setViewedIndex(2);
    expect(useSessionStore.getState().currentIndex).toBe(2);
    // Backward is fine — swipe-card navigation, not a linear walk.
    store.setViewedIndex(0);
    expect(useSessionStore.getState().currentIndex).toBe(0);
    store.setViewedIndex(1);
    expect(useSessionStore.getState().currentIndex).toBe(1);
  });

  test('setViewedIndex ignores out-of-range indices', () => {
    seedSession();
    const store = useSessionStore.getState();
    store.setViewedIndex(99);
    expect(useSessionStore.getState().currentIndex).toBe(0);
    store.setViewedIndex(-1);
    expect(useSessionStore.getState().currentIndex).toBe(0);
  });

  test('questions can be answered in ANY order — no re-queue regardless of order', () => {
    seedSession();
    const store = useSessionStore.getState();
    const ids = [103, 101, 102]; // deliberately out of order

    for (const id of ids) {
      const s = useSessionStore.getState();
      const question = s.questions.find((q) => q.id === id)!;
      expect(s.answers[id]).toBeUndefined(); // never answered yet
      s.recordAnswer(question.id, [question.choices[0].id], wrongAnswer({ combo: 0 }));
    }

    expect(Object.keys(useSessionStore.getState().answers).map(Number).sort()).toEqual([
      101, 102, 103,
    ]);
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
      hearts: { lost: 0, remaining: 5, unlimited: false, next_heart_at: null, earned: false },
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
    store.setViewedIndex(1);

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
    expect(s.currentIndex).toBe(1); // resumed where we left off scrolled to
    expect(s.answers[101]).toMatchObject({ selected: [1], is_correct: true });
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
    expect(s.answers[101]).toMatchObject({ selected: [1], is_correct: true });
    // Withheld explanation persists too — a revisited legendary card still shows "withheld", not a blank.
    expect(s.answers[101].explanation_text).toBeNull();
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
