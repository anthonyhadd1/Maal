import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePatchMe } from '@/api/queries/profile';
import { useToast } from '@/components/feedback/Toast';
import { Mascot } from '@/components/mascot/Mascot';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import {
  onboardingPrevious,
  onboardingProgress,
} from '@/features/onboarding/onboardingProgress';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing } from '@/theme/tokens';

/**
 * Onboarding 3/3 « Notifications » — pre-permission pattern (§9/§10):
 * the OS dialog fires ONLY after « Oui, motive-moi ! ». Either path ends
 * with PATCH onboarding_completed=true → tabs. Scheduling itself = Phase 8.
 */
export function NotificationsScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const patchMe = usePatchMe();
  const activeTrackSlug = useSettingsStore((s) => s.activeTrackSlug);
  const { step, totalSteps } = onboardingProgress('notifications');
  const previous = onboardingPrevious('notifications');
  const [requesting, setRequesting] = useState(false);

  const finish = () => {
    if (patchMe.isPending) return;
    patchMe.mutate(
      { profile: { onboarding_completed: true } },
      {
        onSuccess: () => router.replace('/'),
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  const acceptAndFinish = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      // Dynamic import keeps expo-notifications out of the test/module graph.
      const Notifications = await import('expo-notifications');
      // The underlying browser/OS permission prompt is not guaranteed to
      // settle (observed hanging indefinitely on web in some environments) —
      // race it against a timeout so a stalled prompt can never strand the
      // user mid-onboarding with no way forward.
      const result = await Promise.race([
        Notifications.requestPermissionsAsync(),
        new Promise<{ granted: false }>((resolve) =>
          setTimeout(() => resolve({ granted: false }), 5000),
        ),
      ]);
      if (result.granted) {
        // Seed the daily reminder right away (no-streak copy); every
        // completed session reschedules it with the live streak value.
        const { scheduleStreakReminders } = await import('@/lib/notifications');
        await scheduleStreakReminders(0);
      }
    } catch {
      // Permission failures never block onboarding.
    } finally {
      setRequesting(false);
      finish();
    }
  };

  return (
    <OnboardingStep
      cta={{
        label: t('notifications.yes'),
        onPress: () => void acceptAndFinish(),
        loading: requesting || patchMe.isPending,
      }}
      onBack={previous ? () => router.replace(`/onboarding/${previous}`) : undefined}
      onSkip={finish}
      skipLabel={t('notifications.later')}
      step={step}
      subtitle={t('notifications.pitch')}
      title={t('notifications.title')}
      totalSteps={totalSteps}
    >
      <View style={styles.mascotWrap}>
        <Mascot size={180} state="celebrate" />
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  mascotWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
});
