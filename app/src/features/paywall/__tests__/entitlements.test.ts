import {
  DEFAULT_PLAN,
  PLANS,
  paywallCta,
  purchase,
  resolvePaywallMode,
  restore,
} from '@/features/paywall/entitlements';
import i18n, { i18nReady } from '@/i18n';
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

/**
 * CTA truthfulness.
 *
 * The button label was hardcoded to « Essayer 7 jours gratuits » while the
 * selector let the student pick monthly — which has no trial. The paywall
 * promised a free trial the purchase would never honour.
 */
describe('paywallCta — the button may only promise what the plan gives', () => {
  test('annual: offers the trial and carries the post-trial price', () => {
    expect(paywallCta(PLANS.annual)).toEqual({
      titleKey: 'ctaTrial',
      noteKey: 'ctaNote.trial',
      params: { days: 7, price: '$34.99' },
    });
  });

  test('monthly: NO trial wording anywhere, and the real charge is named', () => {
    const copy = paywallCta(PLANS.monthly);
    expect(copy.titleKey).toBe('ctaNoTrial');
    expect(copy.noteKey).toBe('ctaNote.direct');
    expect(copy.params.days).toBeUndefined();
    expect(copy.params.price).toBe('$4.99');
  });

  test('every plan gets a distinct label — no plan can inherit another’s promise', () => {
    const keys = Object.values(PLANS).map((p) => paywallCta(p).titleKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('a hypothetical trial-bearing monthly plan would offer the trial too', () => {
    // Proves the rule is read off `trialDays`, not off the plan id.
    expect(paywallCta({ ...PLANS.monthly, trialDays: 3 }).titleKey).toBe('ctaTrial');
  });

  describe('the keys it returns actually resolve in both locales', () => {
    beforeAll(async () => {
      await i18nReady;
    });

    test.each(['fr', 'en'])('%s', async (lang) => {
      await i18n.changeLanguage(lang);
      for (const plan of Object.values(PLANS)) {
        const { titleKey, noteKey, params } = paywallCta(plan);
        const title = i18n.t(`paywall:${titleKey}`, params);
        const note = i18n.t(`paywall:${noteKey}`, params);
        // A missing key returns the key itself; interpolation leftovers would
        // ship "{{price}}" to a paying customer.
        expect(title).not.toContain(titleKey);
        expect(title).not.toContain('{{');
        expect(note).not.toContain('{{');
        expect(note).toContain(plan.price);
        // The monthly label must never mention a free trial.
        if (!plan.trialDays) {
          expect(title.toLowerCase()).not.toMatch(/gratuit|free/);
          expect(note.toLowerCase()).not.toMatch(/gratuit|free/);
        }
      }
    });

    afterAll(async () => {
      await i18n.changeLanguage('fr');
    });
  });
});

describe('purchase/restore stubs (RevenueCat drops in later)', () => {
  test('both resolve « unavailable » until purchases are wired', async () => {
    await expect(purchase('annual')).resolves.toEqual({ status: 'unavailable' });
    await expect(purchase('monthly')).resolves.toEqual({ status: 'unavailable' });
    await expect(restore()).resolves.toEqual({ status: 'unavailable' });
  });
});
