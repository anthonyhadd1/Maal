import { useEffect, useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { withAlpha } from '@/lib/color';
import { useReducedMotionPref } from '@/lib/motion';
import { colors } from '@/theme/tokens';

/**
 * RadialRays — a low-alpha sunburst behind reward moments (results star
 * arc, paywall hero). The whole burst rotates VERY slowly (default one
 * turn per 60 s) so the scene feels alive without pulling focus. Rays
 * fade out radially so there is no hard outer edge. Static under reduced
 * motion. Decorative only.
 */

export interface RadialRaysProps {
  /** Diameter in px. */
  size: number;
  /** Ray tint (alpha applied internally via `opacity`). */
  color?: string;
  rayCount?: number;
  /** Peak opacity of a ray near the center. */
  opacity?: number;
  /** Full rotation duration. */
  durationMs?: number;
  /** Unique gradient id (only matters with 2+ bursts mounted). */
  idPrefix?: string;
  style?: StyleProp<ViewStyle>;
}

export function RadialRays({
  size,
  color = colors.xpGold,
  rayCount = 12,
  opacity = 0.14,
  durationMs = 60000,
  idPrefix = 'aceRays',
  style,
}: RadialRaysProps) {
  const reduceMotion = useReducedMotionPref();
  const turn = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(turn);
    turn.value = 0;
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1);
    return () => cancelAnimation(turn);
  }, [turn, reduceMotion, durationMs]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
  }));

  // Wedges around the center; every other ray slightly narrower for rhythm.
  const rays = useMemo(() => {
    const step = 360 / rayCount;
    return Array.from({ length: rayCount }, (_, i) => ({
      key: i,
      rotate: i * step,
      halfWidth: i % 2 === 0 ? 11 : 7,
    }));
  }, [rayCount]);

  const id = `${idPrefix}Fade`;

  return (
    <Animated.View
      aria-hidden
      pointerEvents="none"
      style={[styles.base, { width: size, height: size }, style, spinStyle]}
    >
      <Svg height={size} viewBox="0 0 200 200" width={size}>
        <Defs>
          <RadialGradient cx="0.5" cy="0.5" id={id} rx="0.5" ry="0.5">
            <Stop offset="0.1" stopColor={color} stopOpacity={1} />
            <Stop offset="0.85" stopColor={withAlpha(color, 0)} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G opacity={opacity}>
          {rays.map((ray) => (
            <Path
              d={`M100 100 L${100 - ray.halfWidth} 0 L${100 + ray.halfWidth} 0 Z`}
              fill={`url(#${id})`}
              key={ray.key}
              transform={`rotate(${ray.rotate} 100 100)`}
            />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
  },
});
