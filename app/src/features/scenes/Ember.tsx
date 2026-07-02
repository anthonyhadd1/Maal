import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionPref } from '@/lib/motion';
import { colors } from '@/theme/tokens';

/**
 * Ember — a single glowing mote rising in a loop (streak flame scene):
 * fades in near the base, wiggles sideways as it climbs, shrinks and
 * fades out near the top, then respawns. Stagger several with different
 * `x` / `delayMs` / `durationMs` for a living fire. Renders nothing under
 * reduced motion. Decorative only.
 */

export interface EmberProps {
  /** Horizontal spawn offset (px, relative to the parent's left edge). */
  x: number;
  /** Spawn Y (px from parent top) — embers rise from here. */
  y: number;
  delayMs?: number;
  durationMs?: number;
  /** Dot diameter. */
  size?: number;
  color?: string;
  /** Total climb height. */
  riseHeight?: number;
  /** Sideways wiggle amplitude. */
  drift?: number;
  style?: StyleProp<ViewStyle>;
}

export function Ember({
  x,
  y,
  delayMs = 0,
  durationMs = 2600,
  size = 6,
  color = colors.streakOrange,
  riseHeight = 76,
  drift = 8,
  style,
}: EmberProps) {
  const reduceMotion = useReducedMotionPref();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (reduceMotion) return;
    progress.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1),
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, delayMs, durationMs]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const fadeIn = Math.min(t / 0.18, 1);
    const fadeOut = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
    return {
      opacity: 0.95 * fadeIn * fadeOut,
      transform: [
        { translateY: -riseHeight * t },
        { translateX: drift * Math.sin(t * Math.PI * 3) },
        { scale: 1 - 0.45 * t },
      ],
    };
  });

  if (reduceMotion) return null;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.base,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
  },
});
