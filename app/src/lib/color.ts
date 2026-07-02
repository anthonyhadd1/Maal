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
