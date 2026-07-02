import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n, { i18nReady } from '@/i18n';
import {
  cancelStreakReminders,
  ensureAndroidChannel,
  scheduleStreakReminders,
  LAST_CHANCE_MIN_STREAK,
  STREAK_CHANNEL_ID,
  STREAK_REMINDER_IDS,
} from '@/lib/notifications';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * expo-notifications is mocked globally (src/test/setup.ts) with permission
 * DENIED by default — each test opts into `granted` explicitly, mirroring the
 * "never prompt here" contract (design_mobile.md §9).
 */

const getPermissionsMock = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissionsMock = Notifications.requestPermissionsAsync as jest.Mock;
const scheduleMock = Notifications.scheduleNotificationAsync as jest.Mock;
const cancelMock = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const setChannelMock = Notifications.setNotificationChannelAsync as jest.Mock;

interface ScheduledRequest {
  identifier: string;
  content: { title: string; body: string };
  trigger: { type: string; hour: number; minute: number; channelId?: string };
}

function scheduled(identifier: string): ScheduledRequest | undefined {
  return scheduleMock.mock.calls
    .map(([request]) => request as ScheduledRequest)
    .find((request) => request.identifier === identifier);
}

beforeAll(async () => {
  await i18nReady;
});

describe('scheduleStreakReminders', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    if (i18n.language !== 'fr') await i18n.changeLanguage('fr');
    useSettingsStore.setState({ streakRemindersEnabled: true });
    getPermissionsMock.mockResolvedValue({ granted: true, status: 'granted' });
  });

  test('cancels BOTH previous reminders before scheduling anything', async () => {
    await scheduleStreakReminders(5);

    expect(cancelMock).toHaveBeenCalledWith(STREAK_REMINDER_IDS.evening);
    expect(cancelMock).toHaveBeenCalledWith(STREAK_REMINDER_IDS.lastChance);
    // Every cancel happens strictly before the first schedule.
    const lastCancel = Math.max(...cancelMock.mock.invocationCallOrder);
    const firstSchedule = Math.min(...scheduleMock.mock.invocationCallOrder);
    expect(lastCancel).toBeLessThan(firstSchedule);
  });

  test('19:30 daily reminder carries the tutoiement streak body (fr)', async () => {
    await scheduleStreakReminders(5);

    const evening = scheduled(STREAK_REMINDER_IDS.evening);
    expect(evening).toBeTruthy();
    expect(evening!.trigger).toMatchObject({
      type: 'daily',
      hour: 19,
      minute: 30,
      channelId: STREAK_CHANNEL_ID,
    });
    expect(evening!.content.body).toBe(
      "Ta série de 5 jours t'attend ! Un niveau et c'est réglé.",
    );
  });

  test('no streak → the révision variant body', async () => {
    await scheduleStreakReminders(0);

    expect(scheduleMock).toHaveBeenCalledTimes(1); // never a 22:00 without a streak
    const evening = scheduled(STREAK_REMINDER_IDS.evening);
    expect(evening!.content.body).toBe('5 minutes de révision, ça te dit ?');
  });

  test(`22:00 last-chance is scheduled ONLY from a streak of ${LAST_CHANCE_MIN_STREAK}`, async () => {
    await scheduleStreakReminders(LAST_CHANCE_MIN_STREAK - 1);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduled(STREAK_REMINDER_IDS.lastChance)).toBeUndefined();

    scheduleMock.mockClear();
    await scheduleStreakReminders(LAST_CHANCE_MIN_STREAK);
    expect(scheduleMock).toHaveBeenCalledTimes(2);

    const lastChance = scheduled(STREAK_REMINDER_IDS.lastChance);
    expect(lastChance!.trigger).toMatchObject({
      type: 'daily',
      hour: 22,
      minute: 0,
      channelId: STREAK_CHANNEL_ID,
    });
    expect(lastChance!.content.body).toBe('Ta série de 3 jours expire à minuit.');
  });

  test('settings toggle OFF → cancels and schedules nothing', async () => {
    useSettingsStore.setState({ streakRemindersEnabled: false });

    await scheduleStreakReminders(7);

    expect(cancelMock).toHaveBeenCalledTimes(2);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  test('permission not granted → schedules nothing and NEVER prompts', async () => {
    getPermissionsMock.mockResolvedValue({ granted: false, status: 'undetermined' });

    await scheduleStreakReminders(7);

    expect(scheduleMock).not.toHaveBeenCalled();
    expect(requestPermissionsMock).not.toHaveBeenCalled();
  });

  test('reschedule replaces via stable identifiers (same ids every time)', async () => {
    await scheduleStreakReminders(4);
    await scheduleStreakReminders(5);

    const identifiers = scheduleMock.mock.calls.map(
      ([request]) => (request as ScheduledRequest).identifier,
    );
    expect(identifiers).toEqual([
      STREAK_REMINDER_IDS.evening,
      STREAK_REMINDER_IDS.lastChance,
      STREAK_REMINDER_IDS.evening,
      STREAK_REMINDER_IDS.lastChance,
    ]);
  });

  test('locale follows i18n at schedule time (en strings when app is in en)', async () => {
    await i18n.changeLanguage('en');
    await scheduleStreakReminders(5);

    const evening = scheduled(STREAK_REMINDER_IDS.evening);
    expect(evening!.content.body).toBe("Your 5-day streak is waiting! One level and you're set.");
    await i18n.changeLanguage('fr');
  });
});

describe('cancelStreakReminders / ensureAndroidChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cancelStreakReminders cancels both stable identifiers', async () => {
    await cancelStreakReminders();
    expect(cancelMock).toHaveBeenCalledWith(STREAK_REMINDER_IDS.evening);
    expect(cancelMock).toHaveBeenCalledWith(STREAK_REMINDER_IDS.lastChance);
  });

  test('ensureAndroidChannel is a no-op on iOS, creates the channel on Android', async () => {
    await ensureAndroidChannel();
    expect(setChannelMock).not.toHaveBeenCalled(); // jest-expo runs as ios

    const replaced = jest.replaceProperty(Platform as { OS: string }, 'OS', 'android');
    await ensureAndroidChannel();
    expect(setChannelMock).toHaveBeenCalledWith(
      STREAK_CHANNEL_ID,
      expect.objectContaining({ importance: Notifications.AndroidImportance.DEFAULT }),
    );
    replaced.restore();
  });
});
