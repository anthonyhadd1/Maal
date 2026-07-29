import { accentFill, accentText } from '@/lib/color';
import { colors, hashToHue, medalColors, subjectAccents } from '@/theme/tokens';
import { tints } from '@/theme/tints';

/**
 * Contrast guard.
 *
 * A design audit found ~18 separate places where a raw accent or semantic
 * colour was used as text, or as a fill behind white text — the map header's
 * subject pill measured 2.28:1, answer cards 2.28-3.76:1. That single class of
 * bug is most of why the app read as unpolished: everything looked washed out.
 *
 * These tests encode the rule so it cannot silently come back. They deliberately
 * cover the HASHED fallback hues too, because an unknown subject slug from the
 * API generates a colour nobody ever eyeballed.
 */

function parse(color: string): [number, number, number] {
  const hex = color.trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const hsl = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(color.trim());
  if (hsl) {
    const h = Number(hsl[1]) / 360;
    const s = Number(hsl[2]) / 100;
    const l = Number(hsl[3]) / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    return [
      Math.round(channel(h + 1 / 3) * 255),
      Math.round(channel(h) * 255),
      Math.round(channel(h - 1 / 3) * 255),
    ];
  }
  throw new Error(`unsupported colour in contrast test: ${color}`);
}

function luminance(color: string): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parse(color).map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA_BODY = 4.5;
const AA_LARGE = 3;

/** Every accent the app can ever render: curated + hashed fallbacks. */
const ALL_ACCENTS = [
  ...Object.values(subjectAccents),
  // Seeded concours colours, which override the token map at runtime.
  '#22C55E',
  '#6366F1',
  '#64748B',
  // Unknown slugs generate these.
  ...Array.from({ length: 24 }, (_, i) => hashToHue(`unknown-subject-${i}`)),
];

describe('contrast: the sanity check on the whole reference implementation', () => {
  test('black on white is 21:1 and white on white is 1:1', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('accentText() — accent used as TEXT on light surfaces', () => {
  test.each(ALL_ACCENTS)('clears AA body text on white: %s', (accent) => {
    expect(contrast(accentText(accent), colors.neutral[0])).toBeGreaterThanOrEqual(AA_BODY);
  });

  test.each(ALL_ACCENTS)('clears AA body text on the app background: %s', (accent) => {
    expect(contrast(accentText(accent), colors.neutral[50])).toBeGreaterThanOrEqual(AA_BODY);
  });

  test('a raw accent would NOT pass — proving the helper is doing real work', () => {
    // Biologie's seeded green as text on white.
    expect(contrast('#22C55E', colors.neutral[0])).toBeLessThan(AA_BODY);
  });
});

describe('accentFill() — accent used as a FILL behind white text', () => {
  test.each(ALL_ACCENTS)('white text clears AA on the filled surface: %s', (accent) => {
    expect(contrast(colors.neutral[0], accentFill(accent))).toBeGreaterThanOrEqual(AA_BODY);
  });

  test('the raw fill would NOT pass — this is the map-header bug that shipped', () => {
    expect(contrast(colors.neutral[0], '#22C55E')).toBeLessThan(AA_LARGE);
  });
});

describe('semantic verdict colours used behind white text', () => {
  test('correct-answer surface clears AA', () => {
    expect(contrast(colors.neutral[0], colors.successEdge)).toBeGreaterThanOrEqual(AA_BODY);
  });

  test('wrong-answer surface clears AA', () => {
    expect(contrast(colors.neutral[0], colors.dangerDeep)).toBeGreaterThanOrEqual(AA_BODY);
  });

  test('the previous choices did not — regression anchors', () => {
    expect(contrast(colors.neutral[0], colors.success)).toBeLessThan(AA_LARGE);
    expect(contrast(colors.neutral[0], colors.heartsRed)).toBeLessThan(AA_BODY);
  });
});

/**
 * Brand hues used as TEXT.
 *
 * Gold, flame orange and the semantic greens/reds are all designed to be seen
 * as filled shapes — flames, crowns, medals, bars. Every place the app printed
 * one as type it failed: the results XP hero measured 2.15:1, the quests streak
 * numerals 2.80:1, the chart's "today" axis label 2.80:1. The rule is: glyph
 * keeps the bright hue, text takes the deep token beside it.
 */
describe('brand hues used as text take their deep token', () => {
  const ON_WHITE = colors.neutral[0];

  test('gold: goldDeep clears AA where xpGold does not', () => {
    expect(contrast(colors.goldDeep, ON_WHITE)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrast(colors.xpGold, ON_WHITE)).toBeLessThan(AA_LARGE);
  });

  test('flame: tints.flameText clears AA where streakOrange does not', () => {
    expect(contrast(tints.flameText, ON_WHITE)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrast(colors.streakOrange, ON_WHITE)).toBeLessThan(AA_LARGE);
  });

  test('challenge outcome headlines clear AA in all three tones', () => {
    for (const tone of [colors.successEdge, colors.dangerEdge, colors.primary[700]]) {
      expect(contrast(tone, ON_WHITE)).toBeGreaterThanOrEqual(AA_BODY);
    }
    // The bright hues they replaced would not have.
    expect(contrast(colors.success, ON_WHITE)).toBeLessThan(AA_LARGE);
    expect(contrast(colors.danger, ON_WHITE)).toBeLessThan(AA_BODY);
  });

  test('icon tiles: each readable foreground clears 3:1 on its own 14% wash', () => {
    // Non-text meaningful content needs 3:1 (WCAG 1.4.11). A bright glyph on
    // its own pale tint measures ~1.9:1 — the wash IS the same hue.
    const pairs: [string, string][] = [
      [tints.successText, tints.success],
      [tints.flameText, tints.flame],
      [tints.goldText, tints.gold],
      [tints.iceText, tints.ice],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe('leaderboard medals: the rank numeral must be readable on all three', () => {
  test('ink on gold and silver, white on bronze', () => {
    expect(contrast(colors.neutral[900], medalColors.gold)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrast(colors.neutral[900], medalColors.silver)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrast(colors.neutral[0], medalColors.bronze)).toBeGreaterThanOrEqual(AA_BODY);
  });

  test('the blanket white it replaced failed on the top two — regression anchor', () => {
    expect(contrast(colors.neutral[0], medalColors.gold)).toBeLessThan(AA_LARGE);
    expect(contrast(colors.neutral[0], medalColors.silver)).toBeLessThan(AA_LARGE);
  });
});

describe('paywall savings ribbon', () => {
  test('white on successEdge clears AA; on successDeep it did not', () => {
    expect(contrast(colors.neutral[0], colors.successEdge)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrast(colors.neutral[0], colors.successDeep)).toBeLessThan(AA_BODY);
  });
});

describe('core neutral text pairs', () => {
  test('body text on white and on the app background', () => {
    expect(contrast(colors.neutral[900], colors.neutral[0])).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrast(colors.neutral[900], colors.neutral[50])).toBeGreaterThanOrEqual(AA_BODY);
  });

  test('secondary text still clears AA (neutral[500] was darkened for this)', () => {
    expect(contrast(colors.neutral[500], colors.neutral[0])).toBeGreaterThanOrEqual(AA_BODY);
  });
});
