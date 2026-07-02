import type { MapLevel } from '@/api/types';
import { nodeVisual, offersLegendary } from '@/features/map/LevelNode';

/**
 * Legendary node-press branches (PLAN decision 9 + gameplay §1.5): a press on
 * a playable, 3-star, crown-less node opens the legendary offer dialog; every
 * other press keeps the plain start/replay flow.
 */

function level(overrides: Partial<MapLevel> = {}): MapLevel {
  return {
    id: 1,
    title: 'La cellule',
    order: 1,
    status: 'completed',
    stars: 3,
    is_free_for_me: true,
    ...overrides,
  };
}

describe('offersLegendary', () => {
  test('completed + 3 stars + crown not earned → offers the legendary run', () => {
    expect(offersLegendary(level())).toBe(true);
  });

  test('crown already earned (is_legendary) → plain replay, no dialog', () => {
    expect(offersLegendary(level({ is_legendary: true }))).toBe(false);
  });

  test('under 3 stars → plain replay (2, 1, 0 stars)', () => {
    expect(offersLegendary(level({ stars: 2 }))).toBe(false);
    expect(offersLegendary(level({ stars: 1 }))).toBe(false);
    expect(offersLegendary(level({ stars: 0 }))).toBe(false);
  });

  test('not completed → never offered (unlocked / locked)', () => {
    expect(offersLegendary(level({ status: 'unlocked', stars: 0 }))).toBe(false);
    expect(offersLegendary(level({ status: 'locked', stars: 0 }))).toBe(false);
  });

  test('premium-gated node → paywall wins over the legendary offer', () => {
    const gated = level({ is_free_for_me: false });
    expect(nodeVisual(gated)).toBe('premiumLocked');
    expect(offersLegendary(gated)).toBe(false);
  });

  test('boss levels follow the same rule (3 stars → offer)', () => {
    expect(offersLegendary(level({ is_boss: true }))).toBe(true);
    expect(offersLegendary(level({ is_boss: true, is_legendary: true }))).toBe(false);
  });
});
