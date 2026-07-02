import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePatchMe } from '@/api/queries/profile';
import { useToast } from '@/components/feedback/Toast';
import { Mascot } from '@/components/mascot/Mascot';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
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
      const result = await Notifications.requestPermissionsAsync();
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
      onSkip={finish}
      skipLabel={t('notifications.later')}
      step={2}
      subtitle={t('notifications.pitch')}
      title={t('notifications.title')}
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
