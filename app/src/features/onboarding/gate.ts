import type { AuthStatus } from '@/stores/authStore';

/**
 * Root navigation gate (design_mobile.md §3 + Phase 7 onboarding):
 * - anon → (auth) welcome
 * - authed + onboarding NOT completed → /onboarding/goal
 * - authed + completed (or profile unknown yet) → stay in the tabs
 *
 * `onboardingCompleted` is null while /me/ hasn't resolved — we NEVER block
 * the tabs on it (offline-friendly); the gate re-evaluates when data lands.
 */
export type GateTarget = '/welcome' | '/onboarding/goal' | null;

export function resolveTabsGate(params: {
  status: AuthStatus;
  onboardingCompleted: boolean | null;
}): GateTarget {
  if (params.status !== 'authed') return '/welcome';
  if (params.onboardingCompleted === false) return '/onboarding/goal';
  return null;
}

/** Guard for the /onboarding stack itself. '/' = bounce back to the tabs. */
export function resolveOnboardingGate(params: {
  status: AuthStatus;
  onboardingCompleted: boolean | null;
}): '/welcome' | '/' | null {
  if (params.status !== 'authed') return '/welcome';
  if (params.onboardingCompleted === true) return '/';
  return null;
}
