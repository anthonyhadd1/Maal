/**
 * Semantic surface tints that tokens.ts does not cover yet — soft pastel
 * washes + readable foregrounds for gold/ice/success/danger accents.
 * (Kept next to tokens.ts as an extension; fold into tokens when allowed.)
 */

export const tints = {
  /** Gold/premium wash (icon squares, count pills, trophy tiles). */
  gold: '#FEF3C7',
  /** Readable gold foreground on light surfaces (≥ 4.5:1 on #FEF3C7). */
  goldText: '#92400E',
  /** Streak-freeze / ice wash. */
  ice: '#E0F2FE',
  /** Readable ice-blue foreground. */
  iceText: '#0369A1',
  /** Success wash (promotion zone pill, won chips). */
  success: '#DCFCE7',
  /** Readable success foreground. */
  successText: '#166534',
  /** Danger wash (danger zone pill, destructive settings card). */
  danger: '#FEE2E2',
  /** Readable danger foreground. */
  dangerText: '#B91C1C',
  /** Streak-flame wash. */
  flame: '#FFEDD5',
  /** Readable flame foreground. */
  flameText: '#C2410C',
} as const;

export type TintToken = keyof typeof tints;
