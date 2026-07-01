import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ClayTabBar, type ClayTabBarProps } from '@/components/layout/ClayTabBar';
import { useAuthStore } from '@/stores/authStore';

export default function TabsLayout() {
  const { t } = useTranslation('common');
  const status = useAuthStore((s) => s.status);

  if (status !== 'authed') {
    return <Redirect href="/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <ClayTabBar {...(props as unknown as ClayTabBarProps)} />}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.learn') }} />
      <Tabs.Screen name="leagues" options={{ title: t('tabs.league') }} />
      <Tabs.Screen name="quests" options={{ title: t('tabs.quests') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
