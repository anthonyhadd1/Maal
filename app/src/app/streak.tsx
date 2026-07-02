import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Flame } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { Mascot } from '@/components/mascot/Mascot';
import { Ember, PodiumDisc } from '@/features/scenes';
import { shade, withAlpha } from '@/lib/color';
import { play } from '@/lib/sounds';
import { colors, gradients, scrim, spacing, typography } from '@/theme/tokens';

/**
 * Transparent modal celebrating a streak day earned (routed from the results
 * screen when `streak.extended_today` is true): dark scrim, centered clay
 * card, flame crest on a gradient disc — now a full flame scene: warm
 * stacked radial glow behind the disc, a perspective clay base under it,
 * and ember motes rising around the flame (static-free under reduced
 * motion — the Ember component handles it).
 */

/** Ember field around the flame disc: x/delay/duration/size per mote. */
const EMBERS = [
  { x: 22, delayMs: 0, durationMs: 2700, size: 7, color: colors.streakOrange },
  { x: 52, delayMs: 900, durationMs: 2300, size: 5, color: colors.xpGold },
  { x: 84, delayMs: 1600, durationMs: 2900, size: 6, color: colors.streakOrange },
  { x: 118, delayMs: 400, durationMs: 2500, size: 5, color: '#FBBF24' },
  { x: 146, delayMs: 1200, durationMs: 2800, size: 7, color: colors.xpGold },
  { x: 168, delayMs: 2000, durationMs: 2400, size: 5, color: colors.streakOrange },
] as const;

export default function StreakRoute() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { days } = useLocalSearchParams<{ days?: string }>();
  const count = Number(days ?? 0) || 0;

  // The flame moment gets its own fanfare.
  useEffect(() => {
    play('streak');
  }, []);

  return (
    <View style={styles.scrim}>
      <ClaySurface radius="xl" shadow="floating" style={styles.card}>
        <View style={styles.flameScene}>
          {/* Warm radial glow: two stacked alpha gradients. */}
          <Svg
            height={200}
            pointerEvents="none"
            style={styles.glow}
            viewBox="0 0 200 200"
            width={200}
          >
            <Defs>
              <RadialGradient cx="0.5" cy="0.5" id="streakGlowOuter" rx="0.5" ry="0.5">
                <Stop offset="0" stopColor={withAlpha(colors.streakOrange, 0.22)} />
                <Stop offset="1" stopColor={withAlpha(colors.streakOrange, 0)} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient cx="0.5" cy="0.5" id="streakGlowInner" rx="0.5" ry="0.5">
                <Stop offset="0" stopColor={withAlpha(colors.xpGold, 0.3)} />
                <Stop offset="1" stopColor={withAlpha(colors.xpGold, 0)} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={100} cy={100} fill="url(#streakGlowOuter)" r={100} />
            <Circle cx={100} cy={100} fill="url(#streakGlowInner)" r={64} />
          </Svg>

          <View style={styles.flameDisc}>
            <LinearGradient
              colors={gradients.flame}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Wrapped in a View: on web a bare <svg> is position:static and
                would paint UNDER the absolutely-positioned gradient. */}
            <View style={styles.flameIcon}>
              <Flame color={colors.neutral[0]} fill={colors.neutral[0]} size={56} />
            </View>
          </View>

          {/* Perspective clay base grounding the disc. */}
          <PodiumDisc color={shade(colors.xpGold, 0.45)} width={128} style={styles.base} />

          {/* Ember motes rising around the flame. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {EMBERS.map((ember) => (
              <Ember key={ember.x} riseHeight={86} y={116} {...ember} />
            ))}
          </View>
        </View>

        <Text accessibilityRole="header" style={styles.title}>
          {t('streak.celebrate', { count })}
        </Text>
        <Text style={styles.subtitle}>{t('streak.todayDone', { count })}</Text>
        <Mascot size={116} state="celebrate" />
        <ClayButton
          fullWidth
          onPress={() => router.back()}
          size="l"
          testID="streak-continue"
          title={t('cta.continue')}
          variant="primary"
        />
      </ClaySurface>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  flameScene: {
    width: 190,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    top: -44,
    left: '50%',
    marginLeft: -100,
  },
  flameDisc: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderBottomWidth: 4,
    borderBottomColor: colors.goldDeep,
    zIndex: 2,
  },
  flameIcon: {
    zIndex: 1,
  },
  base: {
    marginTop: -26,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[700],
    textAlign: 'center',
  },
});
