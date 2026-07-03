import { tierNameKey } from '@/features/leagues/tierName';

describe('tierNameKey (localizes the 5 seeded tiers Bronze..Cèdre by stable order)', () => {
  test('maps order 1..5 to the tierNames.* i18n keys, in rank order', () => {
    expect(tierNameKey(1)).toBe('bronze');
    expect(tierNameKey(2)).toBe('argent');
    expect(tierNameKey(3)).toBe('or');
    expect(tierNameKey(4)).toBe('diamant');
    expect(tierNameKey(5)).toBe('cedre');
  });

  test('out-of-range order falls back to null (caller uses the raw tier.name)', () => {
    expect(tierNameKey(0)).toBeNull();
    expect(tierNameKey(6)).toBeNull();
  });
});
