import type { ConfigContext, ExpoConfig } from 'expo/config';

// NOTE: the Expo config loader cannot follow imports into src/, so this value
// is inlined here. Keep in sync with colors.primary[50] in src/theme/tokens.ts.
const PRIMARY_50 = '#F5F3FF';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ACE',
  slug: 'ace',
  version: '0.1.0',
  scheme: 'ace',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'com.aceconcours.app',
    supportsTablet: false,
  },
  android: {
    package: 'com.aceconcours.app',
    adaptiveIcon: {
      backgroundColor: PRIMARY_50,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // Browser support is DEMO-ONLY (laptop walkthroughs) — native is the product.
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-localization',
    'expo-notifications',
    'expo-audio',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: PRIMARY_50,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
