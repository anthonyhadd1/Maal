/**
 * Tier-color helpers for the Ligue hero: the backend sends one hex per tier
 * (bronze #CD7F32, argent, or, …) and the UI derives the tinted band,
 * the medallion edge and readable text from it.
 */

/** "#CD7F32" → {r, g, b}; tolerates short hex; falls back to violet. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = (hex ?? '').replace('#', '').trim();
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  const num = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(num)) return { r: 124, g: 58, b: 237 }; // primary 600
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** rgba() string from a hex + alpha — for soft tier-tinted washes. */
export function tint(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darken a hex by a 0–1 factor — the medallion's clay bottom edge. */
export function darken(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - factor;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

/** Lighten a hex toward white by a 0–1 factor — the medallion's top light. */
export function lighten(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const l = (v: number) => Math.round(v + (255 - v) * factor);
  return `rgb(${l(r)}, ${l(g)}, ${l(b)})`;
}
