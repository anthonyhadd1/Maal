/**
 * Tiny color math for the game screens: derive tints/shades of a subject
 * accent at runtime (accents are data-driven, so gradients can't live in
 * tokens). Handles #rgb/#rrggbb and hsl(h, s%, l%) inputs; anything else
 * passes through unchanged (never crashes on odd API colors).
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(color: string): Rgb | null {
  const hex = color.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function parseHsl(color: string): Rgb | null {
  const match = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(color.trim());
  if (!match) return null;
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const hue = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue(p, q, h + 1 / 3) * 255),
    g: Math.round(hue(p, q, h) * 255),
    b: Math.round(hue(p, q, h - 1 / 3) * 255),
  };
}

function parseColor(color: string): Rgb | null {
  return parseHex(color) ?? parseHsl(color);
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) => clamp255(v).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** `color` with the given alpha (0..1). Unknown formats pass through. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/**
 * Lighten (amount > 0, towards white) or darken (amount < 0, towards black).
 * `amount` in -1..1. Unknown formats pass through.
 */
export function shade(color: string, amount: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const t = Math.max(-1, Math.min(1, amount));
  const target = t > 0 ? 255 : 0;
  const mix = Math.abs(t);
  return toHex({
    r: rgb.r + (target - rgb.r) * mix,
    g: rgb.g + (target - rgb.g) * mix,
    b: rgb.b + (target - rgb.b) * mix,
  });
}

/**
 * Subject accent, darkened enough to be legible as TEXT on the app's light
 * surfaces (white cards and faint accent tints).
 *
 * Accents are data-driven — a subject can arrive from the API with any hue,
 * and unknown slugs fall back to a generated `hsl(h, 65%, 52%)`. The lighter
 * ones (orange #F97316, emerald #10B981, cyan #06B6D4) are nowhere near
 * readable at their raw value: as body text on white they measure ~3.3-3.8:1,
 * under the WCAG AA 4.5:1 minimum. -0.5 is the shallowest darkening at which
 * EVERY accent in the palette — plus every hashed fallback hue — clears 4.5:1
 * both on white and on a 9%-accent tint (worst cases 5.69:1 and 5.24:1).
 *
 * Use this for accent-coloured text. For borders, rings and fills — which are
 * decoration, not information — the raw accent is fine.
 */
export function accentText(accent: string): string {
  return shade(accent, -0.5);
}

/**
 * Subject accent, darkened enough that WHITE text on top of it clears WCAG AA.
 *
 * Raw accents are far too light to carry white text: on the map header's
 * subject pill, white measures 2.28:1 on Biologie's #22C55E and 2.80:1 on
 * Physique's #F97316 — worse than the 3:1 floor for large text, let alone the
 * 4.5:1 body-text bar. -0.45 is the shallowest darkening at which white clears
 * 4.5:1 against every palette accent, every seeded subject colour, and every
 * hashed fallback hue (worst case 4.86:1).
 *
 * Pair with `shade(accent, -0.6)` for the clay bottom lip, as UnitHeader does.
 */
export function accentFill(accent: string): string {
  return shade(accent, -0.45);
}
