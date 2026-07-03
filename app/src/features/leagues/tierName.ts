/**
 * League tiers are seeded data (LeagueTier.order 1..5, Bronze..Cèdre) and the
 * API sends a pre-formatted French `name` alongside the stable `order` —
 * same shape as the quest/achievement localization gap: the client should
 * key off the stable identifier, not trust the raw string, for the tiers
 * this build actually knows about.
 */

const TIER_ORDER_KEYS = ['bronze', 'argent', 'or', 'diamant', 'cedre'];

/** i18n key (leagues.tierNames.*) for a known tier order, or null if out of range. */
export function tierNameKey(order: number): string | null {
  return TIER_ORDER_KEYS[order - 1] ?? null;
}
