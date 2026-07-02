/**
 * ACE design tokens — the single source of truth (design_mobile.md §6).
 * Claymorphism, light-first, French-first.
 *
 * RULE: no raw hex anywhere else in the codebase — always import from here.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  /** Primary violet scale */
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    300: '#C4B5FD',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
  },
  xpGold: '#F59E0B',
  streakOrange: '#F97316',
  heartsRed: '#EF4444',
  success: '#22C55E',
  successDeep: '#16A34A',
  danger: '#EF4444',
  dangerDeep: '#DC2626',
  neutral: {
    0: '#FFFFFF',
    50: '#FAF9FC',
    100: '#F3F1F8',
    300: '#D8D4E3',
    500: '#8E8AA0',
    700: '#4B4763',
    900: '#241F3E',
  },
  /** Streak-freeze snowflake chips. */
  freezeBlue: '#38BDF8',
} as const;

/** Leaderboard rank medals (ranks 1–3). */
export const medalColors = {
  gold: '#F59E0B',
  silver: '#94A3B8',
  bronze: '#B45309',
} as const;

/**
 * Preset avatar palette: deterministic pastel background + readable foreground.
 * Indexed by hashing the avatar_id (see components/game/Avatar).
 */
export const avatarPalette = [
  { bg: '#EDE9FE', fg: '#6D28D9' }, // violet
  { bg: '#DCFCE7', fg: '#15803D' }, // green
  { bg: '#DBEAFE', fg: '#1D4ED8' }, // blue
  { bg: '#FCE7F3', fg: '#BE185D' }, // pink
  { bg: '#FEF3C7', fg: '#B45309' }, // amber
  { bg: '#CFFAFE', fg: '#0E7490' }, // cyan
  { bg: '#FFE4E6', fg: '#BE123C' }, // rose
  { bg: '#D1FAE5', fg: '#047857' }, // emerald
] as const;

export type AvatarPaletteEntry = (typeof avatarPalette)[number];

/** Inner top highlight used on raised clay surfaces. */
export const clayHighlight = 'rgba(255, 255, 255, 0.65)';

/** Soft white overlay for pills/chips sitting on accent-colored surfaces. */
export const overlayLight = 'rgba(255, 255, 255, 0.28)';

/** Scrim behind modals/sheets. */
export const scrim = 'rgba(36, 31, 62, 0.45)';

/** Full-bleed dark backdrop (image zoom, video). */
export const backdropDark = 'rgba(10, 8, 20, 0.96)';

// ---------------------------------------------------------------------------
// Subject accents (slug -> accent). Subjects are data-driven: prefer the
// API-provided color, then this map, then the deterministic hue fallback.
// ---------------------------------------------------------------------------

export const subjectAccents: Record<string, string> = {
  biology: '#10B981',
  chemistry: '#06B6D4',
  physics: '#3B82F6',
  math: '#8B5CF6',
  french: '#EC4899',
  english: '#F59E0B',
  culture: '#EF4444',
  logic: '#14B8A6',
  // French slugs used by the ACE backend seed data.
  biologie: '#10B981',
  chimie: '#06B6D4',
  physique: '#3B82F6',
  maths: '#8B5CF6',
  francais: '#EC4899',
  anglais: '#F59E0B',
  'culture-generale': '#EF4444',
  logique: '#14B8A6',
};

/**
 * Deterministic fallback accent for unknown subject slugs:
 * hash the slug into a hue, keep clay-friendly saturation/lightness.
 */
export function hashToHue(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 52%)`;
}

/** Resolve a subject accent color: API color ?? curated map ?? hashed hue. */
export function getSubjectAccent(slug: string, apiColor?: string | null): string {
  if (apiColor) return apiColor;
  return subjectAccents[slug] ?? hashToHue(slug);
}

// ---------------------------------------------------------------------------
// Spacing (4-base scale)
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Radii (clay range 20–32)
// ---------------------------------------------------------------------------

export const radii = {
  s: 12,
  m: 20,
  l: 24,
  xl: 32,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Clay shadow presets (iOS shadow* + Android elevation)
// ---------------------------------------------------------------------------

export interface ClayShadow {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

export const shadows = {
  /** Resting clay surface. */
  clayRaised: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  /** Swapped in while a clay element is pressed. */
  clayPressed: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** Floating layers: modals, toasts, sheets. */
  clayFloating: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const satisfies Record<string, ClayShadow>;

// ---------------------------------------------------------------------------
// Typography — Nunito 800/900 headings, DM Sans body
// ---------------------------------------------------------------------------

export const fonts = {
  headingBlack: 'Nunito_900Black',
  heading: 'Nunito_800ExtraBold',
  headingBold: 'Nunito_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

export const typography = {
  display: { fontFamily: fonts.headingBlack, fontSize: 32, lineHeight: 38 },
  h1: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 24 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  smallMedium: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, TypeStyle>;

// ---------------------------------------------------------------------------
// Exported token types
// ---------------------------------------------------------------------------

export type Colors = typeof colors;
export type PrimaryShade = keyof Colors['primary'];
export type NeutralShade = keyof Colors['neutral'];
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type ShadowToken = keyof typeof shadows;
export type FontToken = keyof typeof fonts;
export type TypographyVariant = keyof typeof typography;

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  fonts,
  typography,
  clayHighlight,
  overlayLight,
  scrim,
  backdropDark,
  subjectAccents,
} as const;

export type Theme = typeof theme;
