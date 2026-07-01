import { useReducedMotion } from 'react-native-reanimated';

import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Combined reduced-motion preference: OS setting (via Reanimated)
 * OR the in-app settings toggle. Components use this to render
 * static Lottie frames, skip loops and shorten transitions.
 */
export function useReducedMotionPref(): boolean {
  const system = useReducedMotion();
  const inApp = useSettingsStore((s) => s.reduceMotion);
  return system || inApp;
}
