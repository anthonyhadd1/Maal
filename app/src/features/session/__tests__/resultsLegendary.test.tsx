import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { CompleteResponse } from '@/api/types';
import { ToastProvider } from '@/components/feedback/Toast';
import { ResultsScreen } from '@/features/session/ResultsScreen';
import { i18nReady } from '@/i18n';
import { scheduleStreakReminders } from '@/lib/notifications';
import { play } from '@/lib/sounds';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  ATTEMPT_ID,
  completeResponse,
  LEVEL_ID,
  legendaryEarnedComplete,
  legendaryMissComplete,
  startAttemptResponse,
} from '@/test/fixtures/session';

/**
 * Results legendary block (PLAN decision 9): earned → gold crown moment
 * (+40 XP row, legendary SFX); attempted-but-missed → encouraging line.
 * Rendered under reduced motion so every stage is on screen immediately.
 */

const mockPush = jest.fn();
const mockDismissTo = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    dismissAll: jest.fn(),
    dismissTo: mockDismissTo,
  }),
  Redirect: jest.fn(() => null),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ edges: _edges, ...props }: Record<string, unknown>) =>
      React.createElement(View, props),
    SafeAreaProvider: (props: Record<string, unknown>) => React.createElement(View, props),
    useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  };
});

jest.mock('@/lib/sounds', () => ({ play: jest.fn() }));

jest.mock('@/lib/notifications', () => ({
  scheduleStreakReminders: jest.fn(async () => {}),
}));

const playMock = play as jest.Mock;
const scheduleMock = scheduleStreakReminders as jest.Mock;

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: 0, gcTime: 0 },
    },
  });
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

async function renderResults(results: CompleteResponse) {
  useSessionStore.getState().startSession({
    attemptId: ATTEMPT_ID,
    levelId: LEVEL_ID,
    questions: startAttemptResponse.questions,
    legendary: results.legendary?.attempted ?? false,
  });
  useSessionStore.getState().setResults(results);
  return render(<ResultsScreen />, { wrapper: Wrapper });
}

beforeAll(async () => {
  await i18nReady;
});

describe('ResultsScreen — legendary block', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.getState().reset();
    // Reduced motion: the whole choreography renders instantly (no timers).
    // (settingsStore is per-test-file module state — no cross-file leakage.)
    useSettingsStore.setState({ reduceMotion: true });
  });

  test('earned: crown block + « Couronne légendaire ! » + the +40 XP row', async () => {
    await renderResults(legendaryEarnedComplete);

    expect(screen.getByTestId('legendary-earned')).toBeTruthy();
    expect(screen.getByText('Couronne légendaire !')).toBeTruthy();
    // XP breakdown row for the one-time bonus.
    expect(screen.getByText('Couronne légendaire')).toBeTruthy();
    expect(screen.getByText('+40 XP')).toBeTruthy();
    expect(screen.queryByTestId('legendary-not-earned')).toBeNull();
  });

  test('earned: plays the legendary fanfare (and the level-complete jingle)', async () => {
    await renderResults(legendaryEarnedComplete);

    expect(playMock).toHaveBeenCalledWith('legendary');
    expect(playMock).toHaveBeenCalledWith('level_complete');
  });

  test('attempted but missed: encouraging line, no crown, no legendary SFX', async () => {
    await renderResults(legendaryMissComplete);

    expect(screen.getByTestId('legendary-not-earned')).toBeTruthy();
    expect(screen.getByText('Pas cette fois — il te faut 9/10.')).toBeTruthy();
    expect(screen.queryByTestId('legendary-earned')).toBeNull();
    expect(playMock).not.toHaveBeenCalledWith('legendary');
  });

  test('plain completion: no legendary block at all', async () => {
    await renderResults(completeResponse);

    expect(screen.queryByTestId('legendary-earned')).toBeNull();
    expect(screen.queryByTestId('legendary-not-earned')).toBeNull();
    expect(screen.queryByText('Couronne légendaire')).toBeNull();
  });

  test('results mount reschedules the streak reminders with the fresh streak', async () => {
    await renderResults(legendaryEarnedComplete);

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock).toHaveBeenCalledWith(legendaryEarnedComplete.streak.current);
  });

  // Regression: `session` is a fullScreenModal in the root Stack that hosts
  // its OWN nested Stack ([levelId] -> results). `router.dismissAll()` (and
  // `dismiss(n)`) dispatch stack actions that resolve against the nearest
  // navigator in context — the nested one — so they bottomed out at
  // [levelId] instead of closing the whole modal: the map never regained
  // focus and [levelId] re-rendered with an emptied session store, hanging
  // forever on its loading skeleton. `dismissTo(href)` resolves the target
  // against the real route tree (like a Link) and correctly crosses the
  // navigator boundary back to the tabs root.
  describe('« Continuer » navigation (dead-end regression)', () => {
    test('dismisses to the tabs root via dismissTo, not dismissAll/dismiss', async () => {
      await renderResults(legendaryMissComplete); // extended_today: false
      fireEvent.press(screen.getByTestId('results-continue'));

      expect(mockDismissTo).toHaveBeenCalledWith('/');
      expect(mockPush).not.toHaveBeenCalled();
    });

    test('when a streak day was earned, pushes /streak AFTER dismissing to the root', async () => {
      await renderResults(completeResponse); // extended_today: true, current: 3
      const order: string[] = [];
      mockDismissTo.mockImplementation(() => order.push('dismissTo'));
      mockPush.mockImplementation(() => order.push('push'));

      fireEvent.press(screen.getByTestId('results-continue'));

      expect(mockDismissTo).toHaveBeenCalledWith('/');
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/streak',
        params: { days: String(completeResponse.streak.current) },
      });
      expect(order).toEqual(['dismissTo', 'push']);
    });
  });
});
