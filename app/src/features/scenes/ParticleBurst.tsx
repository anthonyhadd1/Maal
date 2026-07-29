import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReducedMotionPref } from '@/lib/motion';
import { colors, scenePalette } from '@/theme/tokens';

/**
 * ParticleBurst — a one-shot puff of small clay particles (circles + tiny
 * four-point sparks) drifting upward and fading, staggered per particle.
 * Fire it on mount of a reward moment (results scene). Renders nothing
 * under reduced motion. Decorative only.
 *
 * Layout is deterministic (golden-ratio hashing per index) so renders are
 * stable across mounts and test snapshots.
 */

export interface ParticleBurstProps {
  /** Scene width the particles spread across. */
  width: number;
  /** Scene height (particles start in the lower half and rise). */
  height: number;
  count?: number;
  /** Particle tints (cycled). Defaults to violet / gold clay tones. */
  palette?: readonly string[];
  /** Per-particle travel duration. */
  durationMs?: number;
  /** Stagger between particle launches. */
  staggerMs?: number;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_TINTS = [
  colors.primary[300],
  colors.xpGold,
  colors.primary[400],
  '#FBBF24',
  scenePalette.crystal,
] as const;

const GOLDEN = 0.61803398875;
const frac = (v: number) => v - Math.floor(v);

export function ParticleBurst({
  width,
  height,
  count = 9,
  palette = DEFAULT_TINTS,
  durationMs = 2400,
  staggerMs = 140,
  style,
}: ParticleBurstProps) {
  const reduceMotion = useReducedMotionPref();

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const hx = frac((i + 1) * GOLDEN);
        const hy = frac((i + 1) * GOLDEN * 7.13);
        return {
          key: i,
          x: 0.06 * width + hx * width * 0.88,
          y: height * (0.55 + hy * 0.4),
          size: 5 + frac(hx * 9.7) * 6,
          rise: height * (0.35 + hy * 0.35),
          drift: (hx - 0.5) * 26,
          delay: i * staggerMs,
          color: palette[i % palette.length],
          spark: i % 3 === 2,
        };
      }),
    [count, width, height, staggerMs, palette],
  );

  if (reduceMotion) return null;

  return (
    <View
      aria-hidden
      pointerEvents="none"
      style={[styles.base, { width, height }, style]}
    >
      {particles.map(({ key, ...particle }) => (
        <Particle durationMs={durationMs} key={key} {...particle} />
      ))}
    </View>
  );
}

function Particle({
  x,
  y,
  size,
  rise,
  drift,
  delay,
  color,
  spark,
  durationMs,
}: {
  x: number;
  y: number;
  size: number;
  rise: number;
  drift: number;
  delay: number;
  color: string;
  spark: boolean;
  durationMs: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: durationMs, easing: Easing.out(Easing.quad) }),
    );
    return () => cancelAnimation(progress);
  }, [progress, delay, durationMs]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    // Ramp in fast, hold, fade out over the last 40%.
    const fadeIn = Math.min(t / 0.12, 1);
    const fadeOut = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    return {
      opacity: 0.9 * fadeIn * fadeOut,
      transform: [
        { translateY: -rise * t },
        { translateX: drift * t },
        { scale: 1 - 0.35 * t },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, { left: x, top: y }, animatedStyle]}>
      {spark ? (
        <Svg height={size * 1.8} viewBox="-5 -5 10 10" width={size * 1.8}>
          <Path
            d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z"
            fill={color}
          />
        </Svg>
      ) : (
        <Svg height={size} viewBox="0 0 10 10" width={size}>
          <Circle cx={5} cy={5} fill={color} r={5} />
        </Svg>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
});
