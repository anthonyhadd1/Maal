/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Global jest setup: native-module mocks shared by every suite.
 */

// --- expo-secure-store: in-memory map with a test-only reset hook ----------
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __reset: () => store.clear(),
    __store: store,
  };
});

// --- async-storage: official mock ------------------------------------------
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// --- expo-haptics -----------------------------------------------------------
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

// --- expo-localization: deterministic fr device ----------------------------
jest.mock('expo-localization', () => ({
  getLocales: () => [
    { languageCode: 'fr', languageTag: 'fr-FR', regionCode: 'FR', textDirection: 'ltr' },
  ],
}));

// --- expo-network -----------------------------------------------------------
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));

// --- reanimated: official mock + the few APIs it lacks ----------------------
// (react-native-worklets resolves to its JS build via the jest resolver
// configured in jest.config.js.)
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    useReducedMotion: () => false,
    cancelAnimation: () => {},
  };
});
