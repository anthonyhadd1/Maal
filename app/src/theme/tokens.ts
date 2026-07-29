/**
 * ACE design tokens — the single source of truth (design_mobile.md §6).
 * Claymorphism, light-first, French-first.
 *
 * RULE: no raw hex anywhere else in the codebase — always import from here.
 */

import { Platform } from 'react-native';

import { shade } from '@/lib/color';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  /** Primary violet scale */
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
  },
  xpGold: '#F59E0B',
  /** Lighter gold — gradient highlight / crest tip / ember accents. */
  xpGoldLight: '#FBBF24',
  /** Darker gold — bottom "clay edge" of gold buttons/chips. */
  goldDeep: '#B45309',
  streakOrange: '#F97316',
  heartsRed: '#EF4444',
  success: '#22C55E',
  successDeep: '#16A34A',
  /** Darker green — bottom "clay edge" of success buttons. */
  successEdge: '#15803D',
  danger: '#EF4444',
  dangerDeep: '#DC2626',
  /** Darker red — bottom "clay edge" of danger buttons. */
  dangerEdge: '#991B1B',
  neutral: {
    0: '#FFFFFF',
    50: '#FAF9FC',
    100: '#F3F1F8',
    200: '#E9E6F1',
    300: '#D8D4E3',
    /** Darkened from #8E8AA0 (2026-07) — the original only measured 3.34:1
     * against white, below the 4.5:1 minimum for the body/caption text it's
     * widely used for. This shade holds ~6.0:1 against white and ~4.9:1
     * against the lightest accent-tinted card background it appears on
     * (TrackCard), while keeping the same muted gray-violet hue. */
    500: '#63616F',
    700: '#4B4763',
    900: '#241F3E',
  },
  /** Streak-freeze snowflake chips. */
  freezeBlue: '#38BDF8',
  /**
   * Near-black "ink" pair for the dark/clinical auth + marketing screens
   * (welcome, login, register, forgot-password, onboarding) — deliberately
   * LESS violet-saturated than `neutral` (which is itself violet-tinted and
   * used everywhere in the light study app) so this reads as sober/clinical
   * rather than "purple app". Violet survives only as a restrained accent on
   * these screens.
   */
  inkTop: '#14121C',
  inkBottom: '#09080D',
} as const;

// ---------------------------------------------------------------------------
// Gradients (expo-linear-gradient color tuples)
// ---------------------------------------------------------------------------

export const gradients = {
  /** Brand backdrop — welcome hero, headers (700 → 800 diagonal).
   * Darkened from (600 → 400) in 2026-07: white/near-white text sitting
   * directly on this gradient (wordmark, tagline, pitch) measured as low as
   * 2.72:1 against the lighter original stop, below both the 3:1 (large
   * text) and 4.5:1 (body text) minimums. Both new stops hold >=5.7:1. */
  brand: [colors.primary[700], colors.primary[800]] as const,
  /** Deeper brand variant for large full-bleed surfaces. Darkened from
   * (700 → 500) alongside `brand` above — the paywall's "pitch" text on the
   * old lighter stop measured 3.57:1, below the 4.5:1 minimum. */
  brandDeep: [colors.primary[800], shade(colors.primary[800], -0.25)] as const,
  /** Streak flame / crest: orange → gold. */
  flame: [colors.streakOrange, colors.xpGold] as const,
  /** XP gold shine. */
  gold: [colors.xpGold, colors.xpGoldLight] as const,
  /** Soft top sheen used on clay elements (white fade-out). */
  sheen: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)'] as const,
  /** Near-black backdrop for the dark/clinical auth + marketing screens. */
  ink: [colors.inkTop, colors.inkBottom] as const,
} as const;

export type GradientToken = keyof typeof gradients;

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

/**
 * Palette of the ACE mascot (young violet phoenix chick, SVG hand-drawn).
 * Kept in tokens so the character stays on-brand everywhere.
 */
export const mascotPalette = {
  bodyDeep: colors.primary[700],
  body: colors.primary[500],
  bodyLight: colors.primary[400],
  wing: colors.primary[600],
  belly: colors.primary[100],
  bellyGlow: colors.neutral[0],
  cheek: 'rgba(236, 72, 153, 0.32)',
  eyeWhite: colors.neutral[0],
  pupil: colors.neutral[900],
  brow: colors.primary[800],
  beak: colors.xpGold,
  beakDeep: colors.goldDeep,
  mouth: colors.primary[800],
  crestBase: colors.streakOrange,
  crestMid: colors.xpGold,
  crestTip: colors.xpGoldLight,
  tongue: '#F472B6',
  tear: colors.freezeBlue,
  groundShadow: 'rgba(36, 31, 62, 0.12)',
} as const;

/**
 * Scene palette — pseudo-3D story scenes (floating islands, orbiting clay
 * props, particles, embers). Additive extension of the clay language:
 * violet clay-grass tops over warm earthy strata, light from the top-left
 * like every other clay surface.
 */
export const scenePalette = {
  /** Floating island — violet clay-grass top disc. */
  islandTop: colors.primary[400],
  islandTopLight: colors.primary[300],
  islandRim: colors.primary[600],
  /** Earthy underside cone strata. */
  earthLight: '#A5806B',
  earth: '#8A6553',
  earthShadow: '#5E4136',
  /** Dangling crystal / root bits under the island. */
  crystal: colors.primary[400],
  crystalDeep: colors.primary[600],
  root: '#6E4E3F',
  /** Soft shadow blob hovering below the island. */
  underShadow: 'rgba(36, 31, 62, 0.30)',
  /** Clay props orbiting the island. */
  bookCover: '#F472B6',
  bookCoverDeep: '#DB2777',
  page: colors.neutral[50],
  pageShade: colors.neutral[200],
  flaskGlass: '#BAE6FD',
  flaskGlassDeep: '#7DD3FC',
  flaskLiquid: colors.success,
  flaskLiquidDeep: colors.successDeep,
} as const;

/** Inner top highlight used on raised clay surfaces. */
export const clayHighlight = 'rgba(255, 255, 255, 0.65)';

/** Soft white overlay for pills/chips sitting on accent-colored surfaces. */
export const overlayLight = 'rgba(255, 255, 255, 0.28)';

/** Scrim behind modals/sheets. */
export const scrim = 'rgba(36, 31, 62, 0.45)';

/** Full-bleed dark backdrop (image zoom, video). */
export const backdropDark = 'rgba(10, 8, 20, 0.96)';

/**
 * Soft ground "contact shadow" under pseudo-3D props (map scenery,
 * level nodes, milestones) — grounds floating clay shapes on the world.
 */
export const contactShadow = 'rgba(36, 31, 62, 0.10)';

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
  /**
   * Layered CSS shadow (soft ambient + tight contact) — react-native-web
   * maps this straight to `box-shadow`, giving clay depth that actually
   * reads on web. Native keeps the shadow* / elevation pair above.
   */
  boxShadow?: string;
}

const webShadow = (value: string): { boxShadow?: string } =>
  Platform.OS === 'web' ? { boxShadow: value } : {};

export const shadows = {
  /** Resting clay surface: soft ambient + tight contact shadow. */
  clayRaised: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
    ...webShadow('0 8px 18px rgba(36, 31, 62, 0.13), 0 2px 5px rgba(36, 31, 62, 0.09)'),
  },
  /** Swapped in while a clay element is pressed. */
  clayPressed: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    ...webShadow('0 2px 5px rgba(36, 31, 62, 0.12)'),
  },
  /** Floating layers: modals, toasts, sheets, the tab dock. */
  clayFloating: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.2,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
    ...webShadow('0 18px 40px rgba(36, 31, 62, 0.22), 0 5px 12px rgba(36, 31, 62, 0.10)'),
  },
} as const satisfies Record<string, ClayShadow>;

/** Focus ring around focused inputs (web `box-shadow`, transparent elsewhere). */
export const focusRing = webShadow(`0 0 0 4px ${colors.primary[100]}`);

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
  gradients,
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
