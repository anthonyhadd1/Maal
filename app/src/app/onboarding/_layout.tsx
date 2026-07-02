import { Redirect, Stack } from 'expo-router';

import { useMe } from '@/api/queries/auth';
import { resolveOnboardingGate } from '@/features/onboarding/gate';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/tokens';

/** Onboarding stack (goal → rhythm → notifications), post-register. */
export default function OnboardingLayout() {
  const status = useAuthStore((s) => s.status);
  const me = useMe();

  const target = resolveOnboardingGate({
    status,
    onboardingCompleted: me.data ? me.data.profile.onboarding_completed : null,
  });
  if (target) {
    return <Redirect href={target} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.neutral[50] },
      }}
    />
  );
}
