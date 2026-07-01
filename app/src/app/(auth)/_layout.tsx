import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/tokens';

export default function AuthLayout() {
  const status = useAuthStore((s) => s.status);

  if (status === 'authed') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.neutral[50] },
      }}
    />
  );
}
