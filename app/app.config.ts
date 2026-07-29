import type { ConfigContext, ExpoConfig } from 'expo/config';

// NOTE: the Expo config loader cannot follow imports into src/, so this value
// is inlined here. Keep in sync with colors.primary[50] in src/theme/tokens.ts.
const PRIMARY_50 = '#F5F3FF';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ACE',
  slug: 'ace',
  version: '1.0.0',
  scheme: 'ace',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'com.aceconcours.app',
    supportsTablet: false,
    config: {
      // Declares "no non-exempt encryption" so App Store Connect stops asking
      // the export-compliance question on every single upload. True for this
      // app: HTTPS only, no custom crypto.
      usesNonExemptEncryption: false,
    },
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
    // Configured, not bare: the bare plugins inject capabilities and English
    // permission strings this French app never uses. expo-audio defaults to
    // background playback, which puts UIBackgroundModes: ['audio'] in the
    // Info.plist — a well-known 2.5.4 rejection for an app whose only sounds
    // are seven short UI effects. expo-secure-store defaults to asking for
    // Face ID.
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-font',
    'expo-localization',
    'expo-notifications',
    [
      'expo-audio',
      {
        enableBackgroundPlayback: false,
        microphonePermission: false,
        // MUST be explicit: the plugin defaults it to true and injects
        // android.permission.RECORD_AUDIO regardless of microphonePermission.
        // The app only plays seven short UI sounds — it never records.
        recordAudioAndroid: false,
      },
    ],
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
