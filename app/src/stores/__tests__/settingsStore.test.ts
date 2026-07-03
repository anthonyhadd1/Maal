import { act, waitFor } from '@testing-library/react-native';

import i18n, { i18nReady } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';

beforeAll(async () => {
  await i18nReady;
});

afterEach(async () => {
  // Restore defaults so suites stay independent.
  act(() => {
    const s = useSettingsStore.getState();
    s.setSoundEnabled(true);
    s.setHapticsEnabled(true);
    s.setReduceMotion(false);
    s.setLocale(null);
    s.setActiveTrackSlug('concours');
  });
  if (i18n.language !== 'fr') {
    await i18n.changeLanguage('fr');
  }
});

describe('settingsStore (settings screen toggles ↔ store)', () => {
  test('sound / haptics / reduce-motion toggles update the store', () => {
    act(() => {
      useSettingsStore.getState().setSoundEnabled(false);
      useSettingsStore.getState().setHapticsEnabled(false);
      useSettingsStore.getState().setReduceMotion(true);
    });
    const state = useSettingsStore.getState();
    expect(state.soundEnabled).toBe(false);
    expect(state.hapticsEnabled).toBe(false);
    expect(state.reduceMotion).toBe(true);
  });

  test('setLocale("en") persists the choice AND switches i18n', async () => {
    act(() => {
      useSettingsStore.getState().setLocale('en');
    });
    expect(useSettingsStore.getState().locale).toBe('en');
    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(i18n.t('common:tabs.learn')).toBe('Learn');
  });

  test('setLocale(null) keeps the current language (follow-device mode)', () => {
    act(() => {
      useSettingsStore.getState().setLocale(null);
    });
    expect(useSettingsStore.getState().locale).toBeNull();
    expect(i18n.language).toBe('fr');
  });

  test('league opt-in lives on the PROFILE (server), not in this store', () => {
    // Regression guard: the settings screen must not grow a local shadow copy.
    expect('leaguesOptIn' in useSettingsStore.getState()).toBe(false);
  });

  test('activeTrackSlug defaults to "concours" and the track switcher can persist a new choice', () => {
    expect(useSettingsStore.getState().activeTrackSlug).toBe('concours');
    act(() => {
      useSettingsStore.getState().setActiveTrackSlug('specialite');
    });
    expect(useSettingsStore.getState().activeTrackSlug).toBe('specialite');
  });
});
