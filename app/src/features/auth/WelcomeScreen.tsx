import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { InkBackdrop } from '@/components/layout/InkBackdrop';
import { useEffectiveScreenHeight, useEffectiveScreenWidth } from '@/components/layout/WebFrame';
import { WelcomeVignette } from '@/features/auth/WelcomeVignette';
import { withAlpha } from '@/lib/color';
import { useReducedMotionPref } from '@/lib/motion';
import { colors, fonts, spacing, typography } from '@/theme/tokens';

/** Below this width the 28pt headline risks a third line — drop one size. */
const NARROW_WIDTH = 360;
/** Below this height the fixed vertical budget doesn't fit — shrink vignette, gaps and top margin. */
const SHORT_HEIGHT = 700;
/** Vignette width cap (375 minus the xl gutters); narrower screens shrink it. */
const VIGNETTE_MAX_WIDTH = 327;

/**
 * Opening screen — "le départ": the phoenix chick stands at level 1 of a
 * glowing path rising into the dark, and the headline names what a stressed
 * 17-year-old just recognized: "Ton concours devient un jeu." No statistics,
 * no feature grid — one vignette in the game's real map language, one
 * two-line promise, one support line of verified facts. The CTA is present
 * and tappable at frame 0.
 */
export function WelcomeScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const width = useEffectiveScreenWidth();
  // Effective (frame-aware) height: inside the web preview frame the rendered
  // screen is ~80px SHORTER than the browser window, so the raw window height
  // would pick the tall layout in a frame that only fits the short one — and
  // the frame's overflow:hidden would clip the CTA area.
  const height = useEffectiveScreenHeight();
  const reduceMotion = useReducedMotionPref();

  const narrow = width < NARROW_WIDTH;
  const short = height < SHORT_HEIGHT;
  const vignetteWidth = Math.min(width - spacing.xl * 2, VIGNETTE_MAX_WIDTH);

  // One entrance pass, top to bottom. The actions panel deliberately has NO
  // entering animation: the primary CTA must never wait for choreography.
  const enter = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.duration(220).delay(delay);

  return (
    <View style={styles.root}>
      <InkBackdrop glowOpacity={0.3} glowSize={560} glowTop="-6%" />

      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
        {/* Quiet identity lockup — brand ceremony demoted, not centered. */}
        <Animated.View
          entering={enter(0)}
          style={[styles.identity, short && styles.identityShort]}
          testID="welcome-identity"
        >
          <Text accessibilityRole="header" style={styles.identityWordmark}>
            {t('welcome.title')}
          </Text>
          <Text style={styles.identityTag}>{t('welcome.identityTag')}</Text>
        </Animated.View>

        {/* Fixed gaps (no onLayout-dependent sizing anywhere on this screen —
            the web preview harness never fires it on this flow). */}
        <View style={short ? styles.gapShort : styles.gap} />

        <View style={styles.vignetteRow}>
          <WelcomeVignette short={short} width={vignetteWidth} />
        </View>

        <View style={short ? styles.gapShort : styles.gap} />

        {/* Two Text elements = deterministic wrap, never a surprise third line. */}
        <Animated.View entering={enter(90)} style={styles.headlineBlock}>
          <Text style={[styles.headlineLine, narrow && styles.headlineLineNarrow]}>
            {t('welcome.headline')}
          </Text>
          <Text
            style={[
              styles.headlineLine,
              narrow && styles.headlineLineNarrow,
              styles.headlineAccent,
            ]}
          >
            {t('welcome.headlineAccent')}
          </Text>
        </Animated.View>

        {/* The only feature text on the screen — verified facts, 3-line budget. */}
        <Animated.View entering={enter(180)} style={styles.supportWrap}>
          <Text numberOfLines={3} style={styles.support}>
            {t('welcome.supportLine')}
          </Text>
        </Animated.View>

        <View style={styles.spacer} />

        <View style={styles.actionsPanel}>
          <View style={styles.actionsPanelInner}>
            <ClayButton
              fullWidth
              onPress={() => router.push('/register')}
              size="l"
              testID="welcome-start"
              title={t('welcome.start')}
              variant="inverted"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/login')}
              style={styles.loginRow}
              testID="welcome-login"
            >
              <Text style={styles.loginMuted}>{t('welcome.haveAccountQ')} </Text>
              <Text style={styles.loginLink}>{t('welcome.signIn')}</Text>
            </Pressable>
            <Text numberOfLines={1} style={styles.reassure}>
              {t('welcome.reassurance')}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.inkBottom,
  },
  safe: {
    flex: 1,
  },
  identity: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  identityShort: {
    marginTop: spacing.m,
  },
  identityWordmark: {
    ...typography.h2,
    fontFamily: fonts.headingBlack,
    color: colors.neutral[0],
  },
  identityTag: {
    ...typography.caption,
    color: withAlpha(colors.primary[300], 0.7),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  gap: {
    height: spacing.l,
  },
  gapShort: {
    height: spacing.s,
  },
  vignetteRow: {
    alignItems: 'center',
  },
  headlineBlock: {
    paddingHorizontal: spacing.xl,
  },
  headlineLine: {
    fontFamily: fonts.headingBlack,
    fontSize: 28,
    lineHeight: 34,
    color: withAlpha(colors.neutral[0], 0.92),
  },
  headlineLineNarrow: {
    fontSize: 26,
    lineHeight: 32,
  },
  headlineAccent: {
    color: colors.primary[300],
  },
  supportWrap: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.s,
  },
  support: {
    ...typography.small,
    color: withAlpha(colors.neutral[0], 0.7),
  },
  spacer: {
    flexGrow: 1,
    flexShrink: 1,
    maxHeight: 120,
    minHeight: spacing.l,
  },
  // Single hairline instead of a filled/bordered panel — the CTA button
  // stays the only raised surface on the screen.
  actionsPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(colors.primary[700], 0.3),
  },
  actionsPanelInner: {
    gap: spacing.s,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.l,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // paddingVertical keeps the visible tap target >= 44pt without relying on
    // hitSlop (which react-native-web doesn't apply reliably).
    paddingVertical: spacing.m,
    marginTop: spacing.xs,
  },
  loginLink: {
    ...typography.small,
    fontFamily: typography.smallMedium.fontFamily,
    color: colors.primary[300],
    textDecorationLine: 'underline',
  },
  loginMuted: {
    ...typography.small,
    color: withAlpha(colors.neutral[0], 0.62),
  },
  // 0.55 alpha (~6.2:1 on ink) — the previous 0.35 measured ~3:1, a live
  // AA failure for 12pt text.
  reassure: {
    ...typography.caption,
    color: withAlpha(colors.neutral[0], 0.55),
    textAlign: 'center',
  },
});
