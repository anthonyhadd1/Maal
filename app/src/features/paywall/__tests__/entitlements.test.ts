import {
  DEFAULT_PLAN,
  PLANS,
  purchase,
  resolvePaywallMode,
  restore,
} from '@/features/paywall/entitlements';
import { entitlementFree, entitlementPremium } from '@/test/fixtures/social';

describe('resolvePaywallMode (premium status view vs pitch)', () => {
  test('premium entitlement → status view', () => {
    expect(resolvePaywallMode(entitlementPremium)).toBe('premium');
  });

  test('free / unknown entitlement → pitch', () => {
    expect(resolvePaywallMode(entitlementFree)).toBe('pitch');
    expect(resolvePaywallMode(undefined)).toBe('pitch');
    expect(resolvePaywallMode(null)).toBe('pitch');
  });
});

describe('plan anchors (design_gameplay.md §7)', () => {
  test('$4.99/mo and $34.99/yr with 42% savings + 7-day trial on annual', () => {
    expect(PLANS.monthly.price).toBe('$4.99');
    expect(PLANS.annual.price).toBe('$34.99');
    expect(PLANS.annual.savingsPct).toBe(42);
    expect(PLANS.annual.trialDays).toBe(7);
    expect(DEFAULT_PLAN).toBe('annual');
  });
});

describe('purchase/restore stubs (RevenueCat drops in later)', () => {
  test('both resolve « unavailable » until purchases are wired', async () => {
    await expect(purchase('annual')).resolves.toEqual({ status: 'unavailable' });
    await expect(purchase('monthly')).resolves.toEqual({ status: 'unavailable' });
    await expect(restore()).resolves.toEqual({ status: 'unavailable' });
  });
});
