import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Haptics wrapper honoring the user's settings toggle.
 * All game components call these helpers — never expo-haptics directly.
 */

function enabled(): boolean {
  return useSettingsStore.getState().hapticsEnabled;
}

/** Light tap — every clay press. */
export function impactLight(): void {
  if (!enabled()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function impactMedium(): void {
  if (!enabled()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Correct answer, level complete… */
export function notifySuccess(): void {
  if (!enabled()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Wrong answer, heart lost… */
export function notifyError(): void {
  if (!enabled()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** Option selected (pre-submit). */
export function selection(): void {
  if (!enabled()) return;
  void Haptics.selectionAsync().catch(() => {});
}
