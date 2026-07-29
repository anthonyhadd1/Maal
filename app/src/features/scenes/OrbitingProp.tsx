import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { useReducedMotionPref } from '@/lib/motion';
import { colors, scenePalette } from '@/theme/tokens';

/**
 * OrbitingProp — a small clay-shaded prop (open book, flask, gold trophy)
 * drifting on a slow elliptical orbit around a scene anchor.
 *
 * Depth is faked with scale breathing: the prop grows slightly on the
 * lower (near) half of its orbit and shrinks on the far half. True
 * occlusion comes from render order — mount the prop BEFORE the island
 * to pass behind it, AFTER to pass in front of its lower edge.
 *
 * Static at its phase position under reduced motion. Decorative only.
 */

export type OrbitPropKind = 'book' | 'flask' | 'trophy';

export interface OrbitingPropProps {
  kind: OrbitPropKind;
  /** Prop width/height in px. */
  size?: number;
  /** Orbit half-width in px. */
  radiusX: number;
  /** Orbit half-height in px (small values read as a tilted orbit plane). */
  radiusY: number;
  /** One full revolution duration. */
  durationMs?: number;
  /** Start angle as a fraction of a turn (0..1) — phase-offset siblings. */
  phase?: number;
  /** Reverse the orbit direction. */
  clockwise?: boolean;
  /** Max extra scale on the near half of the orbit (0.12 → 0.88..1.12). */
  depthScale?: number;
  /** Absolute placement of the ORBIT CENTER within the scene. */
  style?: StyleProp<ViewStyle>;
}

const TWO_PI = Math.PI * 2;

export function OrbitingProp({
  kind,
  size = 44,
  radiusX,
  radiusY,
  durationMs = 14000,
  phase = 0,
  clockwise = true,
  depthScale = 0.12,
  style,
}: OrbitingPropProps) {
  const reduceMotion = useReducedMotionPref();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (reduceMotion) return;
    progress.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, durationMs]);

  const dir = clockwise ? 1 : -1;
  const orbitStyle = useAnimatedStyle(() => {
    const angle = TWO_PI * (progress.value * dir + phase);
    const sin = Math.sin(angle);
    return {
      transform: [
        { translateX: radiusX * Math.cos(angle) },
        { translateY: radiusY * sin },
        // sin > 0 → lower half of the orbit → nearer the viewer.
        { scale: 1 + depthScale * sin },
      ],
    };
  });

  return (
    <Animated.View
      aria-hidden
      pointerEvents="none"
      style={[styles.base, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, style, orbitStyle]}
    >
      <Svg height={size} viewBox="0 0 64 64" width={size}>
        {kind === 'book' ? <BookGlyph /> : kind === 'flask' ? <FlaskGlyph /> : <TrophyGlyph />}
      </Svg>
    </Animated.View>
  );
}

/** Open book: pink clay cover, cream pages meeting at the spine. */
function BookGlyph() {
  return (
    <>
      {/* Cover (deep edge below = clay thickness). */}
      <Path d="M8 26 L32 36 L56 26 L56 46 L32 56 L8 46 Z" fill={scenePalette.bookCoverDeep} />
      <Path d="M8 24 L32 34 L56 24 L56 44 L32 54 L8 44 Z" fill={scenePalette.bookCover} />
      {/* Pages: left lit, right shaded (light from top-left). */}
      <Path d="M11 20 C19 13 28 15 32 21 L32 48 C28 42 19 40 11 44 Z" fill={scenePalette.page} />
      <Path d="M53 20 C45 13 36 15 32 21 L32 48 C36 42 45 40 53 44 Z" fill={scenePalette.pageShade} />
      {/* Text lines. */}
      <Path d="M16 24 C21 21.5 26 22 29 25" fill="none" stroke={colors.neutral[300]} strokeLinecap="round" strokeWidth={2} />
      <Path d="M16 31 C21 28.5 26 29 29 32" fill="none" stroke={colors.neutral[300]} strokeLinecap="round" strokeWidth={2} />
      <Path d="M35 25 C38 22 43 21.5 48 24" fill="none" stroke={colors.neutral[500]} strokeLinecap="round" strokeWidth={2} opacity={0.5} />
      <Path d="M35 32 C38 29 43 28.5 48 31" fill="none" stroke={colors.neutral[500]} strokeLinecap="round" strokeWidth={2} opacity={0.5} />
    </>
  );
}

/** Erlenmeyer flask: pale blue clay glass, green potion, one bubble. */
function FlaskGlyph() {
  return (
    <>
      {/* Glass body. */}
      <Path
        d="M26 8 L38 8 L38 24 L50 46 C52.5 51 49 56 44 56 L20 56 C15 56 11.5 51 14 46 L26 24 Z"
        fill={scenePalette.flaskGlass}
      />
      {/* Right shade for volume. */}
      <Path d="M38 8 L38 24 L50 46 C52.5 51 49 56 44 56 L36 56 L36 8 Z" fill={scenePalette.flaskGlassDeep} opacity={0.55} />
      {/* Potion. */}
      <Path d="M22.5 40 L41.5 40 L47.5 51 C48.5 53.5 46.5 56 44 56 L20 56 C17.5 56 15.5 53.5 16.5 51 Z" fill={scenePalette.flaskLiquid} />
      <Path d="M41.5 40 L47.5 51 C48.5 53.5 46.5 56 44 56 L38 56 L38 40 Z" fill={scenePalette.flaskLiquidDeep} opacity={0.7} />
      {/* Neck rim. */}
      <Rect fill={scenePalette.flaskGlassDeep} height={4} rx={2} width={18} x={23} y={6} />
      {/* Bubble + glass highlight. */}
      <Circle cx={28} cy={46} fill="#FFFFFF" opacity={0.75} r={2.6} />
      <Path d="M27 14 L27 26 L20 39" fill="none" opacity={0.7} stroke="#FFFFFF" strokeLinecap="round" strokeWidth={2.4} />
    </>
  );
}

/** Gold trophy cup: lit bowl, deep-gold handles, stem and base. */
function TrophyGlyph() {
  return (
    <>
      {/* Handles. */}
      <Path d="M18 18 C10 18 8 30 20 33" fill="none" stroke={colors.goldDeep} strokeLinecap="round" strokeWidth={4.5} />
      <Path d="M46 18 C54 18 56 30 44 33" fill="none" stroke={colors.goldDeep} strokeLinecap="round" strokeWidth={4.5} />
      {/* Bowl. */}
      <Path d="M18 12 L46 12 L46 24 C46 34 40 40 32 40 C24 40 18 34 18 24 Z" fill={colors.xpGold} />
      {/* Rim + left light. */}
      <Ellipse cx={32} cy={12.5} fill="#FBBF24" rx={14} ry={3.4} />
      <Path d="M22 16 C22 26 25 33 29 36 C24 33 21 26 21 17 Z" fill="#FFFFFF" opacity={0.5} />
      {/* Stem + base (perspective ellipse). */}
      <Rect fill={colors.goldDeep} height={8} rx={2} width={6} x={29} y={39} />
      <Ellipse cx={32} cy={50} fill={colors.goldDeep} rx={12} ry={4.5} />
      <Ellipse cx={32} cy={48.6} fill={colors.xpGold} rx={12} ry={4.2} />
    </>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
  },
});
