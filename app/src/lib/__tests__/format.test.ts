import i18n, { i18nReady } from '@/i18n';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

beforeAll(async () => {
  await i18nReady;
});

beforeEach(async () => {
  if (i18n.language !== 'fr') {
    await i18n.changeLanguage('fr');
  }
});

// fr grouping uses a (narrow) no-break space depending on the ICU version;
// JS \s matches U+0020, U+00A0 and U+202F alike.
const FR_GROUPED_1234 = /^1\s234$/;

describe('format', () => {
  test('fr number grouping: 1234 -> "1 234"', () => {
    expect(formatNumber(1234)).toMatch(FR_GROUPED_1234);
    expect(formatNumber(999)).toBe('999');
  });

  test('uses the active i18n locale by default', async () => {
    await i18n.changeLanguage('en');
    expect(formatNumber(1234)).toBe('1,234');
  });

  test('explicit locale overrides the active one', () => {
    expect(formatNumber(1234, 'en')).toBe('1,234');
    expect(formatNumber(1234, 'fr')).toMatch(FR_GROUPED_1234);
  });

  test('fr percent has a space before the sign', () => {
    expect(formatPercent(70)).toMatch(/^70\s%$/);
  });

  test('fr dates render French month names', () => {
    expect(formatDate('2026-07-01T10:00:00Z')).toContain('juillet');
    expect(formatDate(new Date(2026, 0, 15))).toContain('janvier');
  });
});
