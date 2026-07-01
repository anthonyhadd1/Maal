/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Resolve react-native-worklets to its non-native (JS) build under jest.
  resolver: 'react-native-worklets/jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  // Prefix-matching (no trailing slash), like jest-expo's default:
  // `expo` also covers expo-modules-core, `react-native` covers -svg/-worklets/….
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native|lottie-react-native|@gorhom/.*))',
  ],
};
