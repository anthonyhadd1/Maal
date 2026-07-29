import * as Linking from 'expo-linking';

/**
 * Privacy policy + terms of use.
 *
 * Apple requires BOTH, and requires them reachable from inside the binary —
 * not just from the App Store listing. For auto-renewable subscriptions
 * (guideline 3.1.2) they must sit at the point of purchase; guideline 5.1.1
 * requires the privacy policy to be accessible generally. Submission is
 * literally blocked without a privacy-policy URL.
 *
 * The URLs come from the build env so the owner sets them once per profile and
 * no code change is needed to point at a new host. `hasLegalLinks()` reports
 * whether they are configured, so the UI can hide dead rows rather than
 * showing a link that goes nowhere.
 */
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? '';

/**
 * Apple's standard EULA is an acceptable Terms of Use and is the fast option:
 * https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
 */
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? '';

export function hasLegalLinks(): boolean {
  return isUsable(PRIVACY_URL) && isUsable(TERMS_URL);
}

export function hasPrivacyLink(): boolean {
  return isUsable(PRIVACY_URL);
}

/** Only https — a cleartext legal page is blocked by ATS on device anyway. */
function isUsable(url: string): boolean {
  return url.startsWith('https://');
}

export async function openLegal(url: string): Promise<void> {
  if (!isUsable(url)) return;
  await Linking.openURL(url).catch(() => {
    // A dead link must not crash the app; the row simply does nothing.
  });
}
