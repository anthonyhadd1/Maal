import type { Entitlement } from '@/api/types';

/**
 * Purchase abstraction (design_gameplay.md §7 + PLAN «entitlement now,
 * RevenueCat later»). The UI ONLY talks to this module: when RevenueCat
 * lands, purchase()/restore() get real bodies and nothing else changes.
 *
 * Product ids reserved: maal_premium_monthly / maal_premium_annual
 * (kept as RevenueCat offerings so prices stay tunable without a release).
 */

export type PlanId = 'monthly' | 'annual';

export interface PaywallPlan {
  id: PlanId;
  /** USD anchor price, rendered verbatim (Lebanon pricing, USD-only). */
  price: string;
  /** % saved vs monthly — annual only. */
  savingsPct?: number;
  /** Free-trial length in days — annual only. */
  trialDays?: number;
}

export const PLANS: Record<PlanId, PaywallPlan> = {
  monthly: { id: 'monthly', price: '$4.99' },
  annual: { id: 'annual', price: '$34.99', savingsPct: 42, trialDays: 7 },
};

/** Annual is preselected (best anchor). */
export const DEFAULT_PLAN: PlanId = 'annual';

/** i18n keys + params for the CTA label and the charge note beneath it. */
export interface PaywallCtaCopy {
  titleKey: 'ctaTrial' | 'ctaNoTrial';
  noteKey: 'ctaNote.trial' | 'ctaNote.direct';
  params: { days?: number; price: string };
}

/**
 * What the purchase button may promise for a given plan.
 *
 * The label used to be the constant « Essayer 7 jours gratuits » while the
 * selector let you pick monthly, which has NO trial — the paywall promised
 * something the purchase would never deliver. Deriving both the label and the
 * note from the plan itself makes that impossible, and keeps the rule unit
 * testable without rendering the whole animated screen.
 */
export function paywallCta(plan: PaywallPlan): PaywallCtaCopy {
  return plan.trialDays
    ? {
        titleKey: 'ctaTrial',
        noteKey: 'ctaNote.trial',
        params: { days: plan.trialDays, price: plan.price },
      }
    : { titleKey: 'ctaNoTrial', noteKey: 'ctaNote.direct', params: { price: plan.price } };
}

export type PurchaseOutcome =
  | { status: 'unavailable' } // purchases not wired yet (v1)
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message?: string };

/** RevenueCat stub — purchases arrive in a later phase. */
export async function purchase(_plan: PlanId): Promise<PurchaseOutcome> {
  return { status: 'unavailable' };
}

/** RevenueCat stub — restore arrives with purchases. */
export async function restore(): Promise<PurchaseOutcome> {
  return { status: 'unavailable' };
}

export type PaywallMode = 'premium' | 'pitch';

/** Premium users see their status; everyone else gets the pitch. */
export function resolvePaywallMode(entitlement: Entitlement | null | undefined): PaywallMode {
  return entitlement?.is_premium ? 'premium' : 'pitch';
}
