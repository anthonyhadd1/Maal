import { resolveOnboardingGate, resolveTabsGate } from '@/features/onboarding/gate';

describe('resolveTabsGate (root gate: authed + !onboarding_completed → onboarding)', () => {
  test('anon → welcome', () => {
    expect(resolveTabsGate({ status: 'anon', onboardingCompleted: null })).toBe('/welcome');
  });

  test('authed + onboarding NOT completed → /onboarding/track', () => {
    expect(resolveTabsGate({ status: 'authed', onboardingCompleted: false })).toBe(
      '/onboarding/track',
    );
  });

  test('authed + completed → stay in the tabs', () => {
    expect(resolveTabsGate({ status: 'authed', onboardingCompleted: true })).toBeNull();
  });

  test('authed + /me/ not resolved yet → never blocks the tabs (offline-friendly)', () => {
    expect(resolveTabsGate({ status: 'authed', onboardingCompleted: null })).toBeNull();
  });
});

describe('resolveOnboardingGate (guard on the onboarding stack itself)', () => {
  test('anon → welcome', () => {
    expect(resolveOnboardingGate({ status: 'anon', onboardingCompleted: null })).toBe('/welcome');
  });

  test('already completed → bounce back to the tabs', () => {
    expect(resolveOnboardingGate({ status: 'authed', onboardingCompleted: true })).toBe('/');
  });

  test('authed + incomplete (or unknown) → stay', () => {
    expect(resolveOnboardingGate({ status: 'authed', onboardingCompleted: false })).toBeNull();
    expect(resolveOnboardingGate({ status: 'authed', onboardingCompleted: null })).toBeNull();
  });
});
