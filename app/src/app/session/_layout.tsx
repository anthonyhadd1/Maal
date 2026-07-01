import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/tokens';

/**
 * Question-session stack: fullScreenModal (set on the root Stack entry),
 * swipe-dismiss disabled everywhere — hearts can't be dodged; quitting goes
 * through the confirm dialog (design_mobile.md §3).
 */
export default function SessionLayout() {
  const status = useAuthStore((s) => s.status);

  if (status !== 'authed') {
    return <Redirect href="/welcome" />;
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
