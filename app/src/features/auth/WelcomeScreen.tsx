import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Flame, GraduationCap, Map, Trophy, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { Mascot } from '@/components/mascot/Mascot';
import { FloatingIsland, OrbitingProp } from '@/features/scenes';
import { useReducedMotionPref } from '@/lib/motion';
import { colors, gradients, overlayLight, radii, spacing, typography } from '@/theme/tokens';

/**
 * The opening scene: the phoenix chick standing on a floating clay island,
 * three study props (book, flask, trophy) orbiting at different depths —
 * the trophy passes IN FRONT of the island's lower edge for occlusion
 * depth. Background blobs drift slower than the island (parallax layers).
 */
export function WelcomeScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.brand}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Far parallax layer: soft blobs, drifting slower than the island. */}
      <DriftBlob dx={9} dy={7} durationMs={16000} style={[styles.blob, styles.blobA]} />
      <DriftBlob delayMs={1200} dx={-7} dy={9} durationMs={19000} style={[styles.blob, styles.blobB]} />
      <DriftBlob delayMs={2400} dx={8} dy={-8} durationMs={17000} style={[styles.blob, styles.blobC]} />

      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <GraduationCap color={colors.neutral[0]} size={14} strokeWidth={2.6} />
            <Text style={styles.badgeLabel}>{t('welcome.badge')}</Text>
          </View>

          <View style={styles.scene}>
            {/* Far props — occluded by the island on the low half of their orbit. */}
            <OrbitingProp
              durationMs={13000}
              kind="book"
              phase={0.3}
              radiusX={150}
              radiusY={30}
              size={44}
              style={styles.orbitBook}
            />
            <OrbitingProp
              clockwise={false}
              durationMs={17000}
              kind="flask"
              phase={0.82}
              radiusX={160}
              radiusY={24}
              size={40}
              style={styles.orbitFlask}
            />
            <FloatingIsland bobAmplitude={7} bobDurationMs={10000} size={264}>
              <Mascot size={142} state="idle" />
            </FloatingIsland>
            {/* Near prop — crosses IN FRONT of the island's lower edge. */}
            {/* Flat low sweep: stays below the island so the always-on-top
                layer never contradicts the depth read. */}
            <OrbitingProp
              depthScale={0.14}
              durationMs={15000}
              kind="trophy"
              phase={0.05}
              radiusX={120}
              radiusY={13}
              size={46}
              style={styles.orbitLow}
            />
          </View>

          <Text accessibilityRole="header" style={styles.wordmark}>
            {t('welcome.title')}
          </Text>
          <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
          <Text style={styles.pitch}>{t('welcome.pitch')}</Text>

          <View style={styles.chips}>
            <FeatureChip Icon={Map} label={t('welcome.featureLevels')} />
            <FeatureChip Icon={Flame} label={t('welcome.featureStreaks')} />
            <FeatureChip Icon={Trophy} label={t('welcome.featureLeagues')} />
          </View>
        </View>

        <View style={styles.actions}>
          <ClayButton
            fullWidth
            onPress={() => router.push('/register')}
            size="l"
            title={t('welcome.start')}
            variant="inverted"
          />
          <ClayButton
            fullWidth
            onPress={() => router.push('/login')}
            size="l"
            title={t('welcome.haveAccount')}
            variant="ghost"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Background blob with a slow diagonal drift loop — the far parallax
 * layer behind the island (smaller travel, longer period). Static under
 * reduced motion.
 */
function DriftBlob({
  dx,
  dy,
  durationMs,
  delayMs = 0,
  style,
}: {
  dx: number;
  dy: number;
  durationMs: number;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotionPref();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (reduceMotion) return;
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, durationMs, delayMs]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx * (progress.value * 2 - 1) },
      { translateY: dy * (progress.value * 2 - 1) },
    ],
  }));

  return <Animated.View pointerEvents="none" style={[style, driftStyle]} />;
}

function FeatureChip({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <View style={styles.chip}>
      <Icon color={colors.neutral[0]} size={14} strokeWidth={2.4} />
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary[600],
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  blob: {
    position: 'absolute',
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[0],
  },
  blobA: {
    width: 260,
    height: 260,
    top: -90,
    right: -80,
    opacity: 0.1,
  },
  blobB: {
    width: 180,
    height: 180,
    top: '38%',
    left: -90,
    opacity: 0.08,
  },
  blobC: {
    width: 320,
    height: 320,
    bottom: -140,
    right: -110,
    opacity: 0.07,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: overlayLight,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.m,
    marginBottom: spacing.xs,
  },
  badgeLabel: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.neutral[0],
    letterSpacing: 0.2,
  },
  scene: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  // Orbit anchors: % offsets are relative to the scene box (island + mascot).
  orbitBook: {
    left: '50%',
    top: '46%',
  },
  orbitFlask: {
    left: '50%',
    top: '38%',
  },
  orbitLow: {
    left: '50%',
    top: '72%',
  },
  wordmark: {
    ...typography.display,
    fontSize: 52,
    lineHeight: 58,
    color: colors.neutral[0],
    letterSpacing: -1.5,
  },
  tagline: {
    ...typography.h2,
    color: colors.neutral[0],
    textAlign: 'center',
    opacity: 0.95,
  },
  pitch: {
    ...typography.small,
    color: colors.neutral[0],
    textAlign: 'center',
    opacity: 0.78,
    maxWidth: 300,
    marginTop: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.s,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: overlayLight,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.s + 2,
  },
  chipLabel: {
    ...typography.smallMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.neutral[0],
  },
  actions: {
    gap: spacing.m,
    paddingBottom: spacing.l,
  },
});
