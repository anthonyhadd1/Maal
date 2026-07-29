import '@/i18n';

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { persistOptions, queryClient } from '@/api/queryClient';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ToastProvider } from '@/components/feedback/Toast';
import { WebFrame } from '@/components/layout/WebFrame';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { colors } from '@/theme/tokens';

// Keep the native splash visible until fonts + auth bootstrap + settings hydration.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const authStatus = useAuthStore((s) => s.status);
  const settingsHydrated = useSettingsStore((s) => s.hasHydrated);

  useEffect(() => {
    void useAuthStore.getState().bootstrap();
  }, []);

  const ready = fontsLoaded && authStatus !== 'boot' && settingsHydrated;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <WebFrame>
      <ThemeProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <BottomSheetModalProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: styles.content,
                }}
              >
                {/* Interrupting flows are modals (design_mobile.md §3). */}
                <Stack.Screen
                  name="session"
                  options={{
                    presentation: 'fullScreenModal',
                    gestureEnabled: false,
                    animation: 'slide_from_bottom',
                  }}
                />
                <Stack.Screen
                  name="subject/switcher"
                  options={{ presentation: 'formSheet', sheetAllowedDetents: [0.75, 1] }}
                />
                <Stack.Screen
                  name="subject/chapters"
                  options={{ presentation: 'formSheet', sheetAllowedDetents: [0.75, 1] }}
                />
                <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
                <Stack.Screen
                  name="streak"
                  options={{
                    presentation: 'transparentModal',
                    animation: 'fade',
                    contentStyle: styles.transparent,
                  }}
                />
              </Stack>
              <OfflineBanner />
            </ToastProvider>
          </BottomSheetModalProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
      </WebFrame>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    backgroundColor: colors.neutral[50],
  },
  transparent: {
    backgroundColor: 'transparent',
  },
});
