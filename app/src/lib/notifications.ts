import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Local streak-reminder notifications (design_mobile.md §9 + gameplay §3).
 *
 * - Rescheduled after EVERY completed session with the fresh streak value.
 * - 19:30 daily: « Ta série de {n} jours t'attend ! » (or the no-streak line).
 * - 22:00 daily, ONLY when the streak is ≥ 3: last-chance warning.
 * - NEVER prompts for permission here — the onboarding pre-prompt owns the one
 *   OS dialog. No permission (or toggle off) → everything stays cancelled.
 * - Strings resolve through i18next at schedule time (current locale).
 */

export const STREAK_CHANNEL_ID = 'streak';

/** Stable identifiers so a reschedule replaces instead of stacking. */
export const STREAK_REMINDER_IDS = {
  evening: 'streak-reminder-1930',
  lastChance: 'streak-reminder-2200',
} as const;

export const EVENING_REMINDER = { hour: 19, minute: 30 } as const;
export const LAST_CHANCE_REMINDER = { hour: 22, minute: 0 } as const;
/** The 22:00 « dernière chance » reminder only fires from this streak length. */
export const LAST_CHANCE_MIN_STREAK = 3;

/** Android needs a channel before anything can be scheduled (importance default). */
export async function ensureAndroidChannel(
  channelId: string = STREAK_CHANNEL_ID,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: i18n.t('notifications.channelName', { ns: 'common' }),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Cancels both scheduled streak reminders (settings toggle off, logout…). */
export async function cancelStreakReminders(): Promise<void> {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_IDS.evening),
    Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_IDS.lastChance),
  ]);
}

/**
 * Cancel-then-reschedule the daily reminders for the given streak.
 * Safe to call blindly after each completed session: it no-ops (beyond the
 * cancel) when the user disabled reminders or never granted permission.
 */
export async function scheduleStreakReminders(streakCurrent: number): Promise<void> {
  try {
    await cancelStreakReminders();

    if (!useSettingsStore.getState().streakRemindersEnabled) return;

    // Read-only permission check — prompting belongs to the onboarding flow.
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;

    await ensureAndroidChannel();

    const t = i18n.getFixedT(null, 'common');
    const streak = Math.max(0, Math.floor(streakCurrent));

    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_REMINDER_IDS.evening,
      content: {
        title: t('notifications.streak.title'),
        body:
          streak > 0
            ? t('notifications.streak.eveningBody', { count: streak })
            : t('notifications.streak.noStreakBody'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: STREAK_CHANNEL_ID,
        ...EVENING_REMINDER,
      },
    });

    if (streak >= LAST_CHANCE_MIN_STREAK) {
      await Notifications.scheduleNotificationAsync({
        identifier: STREAK_REMINDER_IDS.lastChance,
        content: {
          title: t('notifications.streak.lastChanceTitle'),
          body: t('notifications.streak.lastChanceBody', { count: streak }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: STREAK_CHANNEL_ID,
          ...LAST_CHANCE_REMINDER,
        },
      });
    }
  } catch {
    // Notifications are best-effort — never let scheduling break the app flow.
  }
}
