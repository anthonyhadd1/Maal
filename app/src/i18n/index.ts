import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from '@/i18n/locales/en/auth.json';
import enCommon from '@/i18n/locales/en/common.json';
import enErrors from '@/i18n/locales/en/errors.json';
import enFriends from '@/i18n/locales/en/friends.json';
import enLeagues from '@/i18n/locales/en/leagues.json';
import enMap from '@/i18n/locales/en/map.json';
import enOnboarding from '@/i18n/locales/en/onboarding.json';
import enPaywall from '@/i18n/locales/en/paywall.json';
import enProfile from '@/i18n/locales/en/profile.json';
import enQuests from '@/i18n/locales/en/quests.json';
import enSession from '@/i18n/locales/en/session.json';
import frAuth from '@/i18n/locales/fr/auth.json';
import frCommon from '@/i18n/locales/fr/common.json';
import frErrors from '@/i18n/locales/fr/errors.json';
import frFriends from '@/i18n/locales/fr/friends.json';
import frLeagues from '@/i18n/locales/fr/leagues.json';
import frMap from '@/i18n/locales/fr/map.json';
import frOnboarding from '@/i18n/locales/fr/onboarding.json';
import frPaywall from '@/i18n/locales/fr/paywall.json';
import frProfile from '@/i18n/locales/fr/profile.json';
import frQuests from '@/i18n/locales/fr/quests.json';
import frSession from '@/i18n/locales/fr/session.json';

export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const namespaces = [
  'common',
  'auth',
  'map',
  'session',
  'leagues',
  'quests',
  'friends',
  'profile',
  'onboarding',
  'errors',
  'paywall',
] as const;

export const resources = {
  fr: {
    common: frCommon,
    auth: frAuth,
    map: frMap,
    session: frSession,
    leagues: frLeagues,
    quests: frQuests,
    friends: frFriends,
    profile: frProfile,
    onboarding: frOnboarding,
    errors: frErrors,
    paywall: frPaywall,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    map: enMap,
    session: enSession,
    leagues: enLeagues,
    quests: enQuests,
    friends: enFriends,
    profile: enProfile,
    onboarding: enOnboarding,
    errors: enErrors,
    paywall: enPaywall,
  },
} as const;

function isSupported(code: string | null | undefined): code is SupportedLocale {
  return !!code && (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

/**
 * Resolution order: persisted user choice ?? device locale ?? fr.
 * The persisted choice lives in settingsStore (hydrated async) and is applied
 * by the store's rehydrate hook / setLocale action via i18n.changeLanguage.
 */
export function detectInitialLocale(persisted?: string | null): SupportedLocale {
  if (isSupported(persisted)) return persisted;
  const device = Localization.getLocales()[0]?.languageCode;
  if (isSupported(device)) return device;
  return 'fr';
}

/** Resolves once i18next is initialized (bundled resources: effectively immediate). */
export const i18nReady: Promise<unknown> = i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLocale(),
  fallbackLng: 'fr',
  ns: namespaces,
  defaultNS: 'common',
  compatibilityJSON: 'v4',
  interpolation: {
    // React already escapes output.
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
