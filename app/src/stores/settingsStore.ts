import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import i18n, { type SupportedLocale } from '@/i18n';

interface SettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reduceMotion: boolean;
  /** « Rappels de série » — local streak reminder notifications (default on). */
  streakRemindersEnabled: boolean;
  /** Persisted user choice; null = follow device locale. */
  locale: SupportedLocale | null;
  activeSubjectSlug: string | null;
  /** Active exam track (« concours » | « specialite »…). Default 'concours'. */
  activeTrackSlug: string;
  /** True once AsyncStorage rehydration finished (gates the splash screen). */
  hasHydrated: boolean;

  setSoundEnabled: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
  setStreakRemindersEnabled: (value: boolean) => void;
  setLocale: (locale: SupportedLocale | null) => void;
  setActiveSubjectSlug: (slug: string | null) => void;
  setActiveTrackSlug: (slug: string) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      hapticsEnabled: true,
      reduceMotion: false,
      streakRemindersEnabled: true,
      locale: null,
      activeSubjectSlug: null,
      activeTrackSlug: 'concours',
      hasHydrated: false,

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setStreakRemindersEnabled: (streakRemindersEnabled) => set({ streakRemindersEnabled }),
      setLocale: (locale) => {
        set({ locale });
        if (locale && locale !== i18n.language) {
          void i18n.changeLanguage(locale);
        }
      },
      setActiveSubjectSlug: (activeSubjectSlug) => set({ activeSubjectSlug }),
      setActiveTrackSlug: (activeTrackSlug) => set({ activeTrackSlug }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'ace.settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        hapticsEnabled: state.hapticsEnabled,
        reduceMotion: state.reduceMotion,
        streakRemindersEnabled: state.streakRemindersEnabled,
        locale: state.locale,
        activeSubjectSlug: state.activeSubjectSlug,
        activeTrackSlug: state.activeTrackSlug,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply the persisted locale choice once, then unblock the splash gate.
        if (state?.locale && state.locale !== i18n.language) {
          void i18n.changeLanguage(state.locale);
        }
        useSettingsStore.getState().setHasHydrated(true);
      },
    },
  ),
);
