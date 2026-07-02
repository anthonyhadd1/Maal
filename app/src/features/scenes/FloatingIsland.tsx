import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { useReducedMotionPref } from '@/lib/motion';
import { scenePalette } from '@/theme/tokens';

/**
 * FloatingIsland — the pseudo-3D clay island the story scenes stand on.
 *
 * Layered SVG: violet clay-grass top disc (lit from the top-left), thick
 * rim lip with clay drips, earthy underside cone with strata bands, 2-3
 * dangling crystal/root bits, and a soft shadow blob hovering below.
 * The island bobs slowly (±bobAmplitude, one full cycle per
 * bobDurationMs) while the under-shadow counter-breathes (shrinks +
 * lightens as the island rises). Static under reduced motion.
 *
 * `children` (e.g. the mascot) ride the bob, standing on the top disc —
 * pulled down onto the surface by `childOverlap × size`.
 *
 * Purely decorative: hidden from screen readers, never intercepts touches.
 */

const VIEW_W = 320;
const VIEW_H = 260;

export interface IslandPalette {
  top: string;
  topLight: string;
  rim: string;
  earthLight: string;
  earth: string;
  earthShadow: string;
  crystal: string;
  crystalDeep: string;
  root: string;
  underShadow: string;
}

const DEFAULT_PALETTE: IslandPalette = {
  top: scenePalette.islandTop,
  topLight: scenePalette.islandTopLight,
  rim: scenePalette.islandRim,
  earthLight: scenePalette.earthLight,
  earth: scenePalette.earth,
  earthShadow: scenePalette.earthShadow,
  crystal: scenePalette.crystal,
  crystalDeep: scenePalette.crystalDeep,
  root: scenePalette.root,
  underShadow: scenePalette.underShadow,
};

export interface FloatingIslandProps {
  /** Rendered width in px (height follows the 320:260 viewBox). */
  size?: number;
  /** Override any island color (e.g. gold-tinted paywall island). */
  palette?: Partial<IslandPalette>;
  /** Vertical bob amplitude in px (island travels ±amplitude). */
  bobAmplitude?: number;
  /** Full up-down-up cycle duration. */
  bobDurationMs?: number;
  /** Fraction of `size` the child sinks down onto the top disc. */
  childOverlap?: number;
  /** Unique SVG gradient id prefix (only matters with 2+ islands mounted). */
  idPrefix?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function FloatingIsland({
  size = 300,
  palette,
  bobAmplitude = 8,
  bobDurationMs = 10000,
  childOverlap = 0.27,
  idPrefix = 'aceIsland',
  children,
  style,
}: FloatingIslandProps) {
  const reduceMotion = useReducedMotionPref();
  const p = { ...DEFAULT_PALETTE, ...palette };

  // 0 → island at its low point, 1 → at its high point.
  const lift = useSharedValue(0.5);

  useEffect(() => {
    cancelAnimation(lift);
    lift.value = 0.5;
    if (reduceMotion) return;
    const half = bobDurationMs / 2;
    lift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: half / 2, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(lift);
  }, [lift, reduceMotion, bobDurationMs]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -bobAmplitude * (lift.value * 2 - 1) }],
  }));

  // The hovering shadow blob shrinks + fades as the island rises.
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.4 * lift.value,
    transform: [{ scaleX: 1.06 - 0.16 * lift.value }],
  }));

  const islandH = (size * VIEW_H) / VIEW_W;
  const shadowW = size * 0.52;
  const shadowH = size * 0.09;

  const idTop = `${idPrefix}Top`;
  const idEarth = `${idPrefix}Earth`;
  const idShadow = `${idPrefix}Shadow`;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.base, { width: size }, style]}
    >
      <Animated.View style={bobStyle}>
        {children != null ? (
          <View style={[styles.child, { marginBottom: -size * childOverlap }]}>{children}</View>
        ) : null}
        <Svg height={islandH} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width={size}>
          <Defs>
            <LinearGradient id={idTop} x1="0" x2="0.6" y1="0" y2="1">
              <Stop offset="0" stopColor={p.topLight} />
              <Stop offset="1" stopColor={p.top} />
            </LinearGradient>
            <LinearGradient id={idEarth} x1="0.2" x2="0.65" y1="0" y2="1">
              <Stop offset="0" stopColor={p.earthLight} />
              <Stop offset="0.55" stopColor={p.earth} />
              <Stop offset="1" stopColor={p.earthShadow} />
            </LinearGradient>
          </Defs>

          {/* Chunky root strand dangling left of the tip. */}
          <Path
            d="M146 198 q-8 12 -2 22 q4 8 -2 12"
            fill="none"
            stroke={p.root}
            strokeLinecap="round"
            strokeWidth={7}
          />

          {/* Earthy underside cone: concave sides, tucked under the lip. */}
          <Path d="M70 76 C88 148 126 200 160 206 C194 200 232 148 250 76 Z" fill={`url(#${idEarth})`} />
          {/* Strata bands (perspective-curved). */}
          <Path d="M84 114 Q160 146 236 114 L230 132 Q160 162 90 132 Z" fill={p.earthShadow} opacity={0.38} />
          <Path d="M104 158 Q160 182 216 158 L210 174 Q160 194 110 174 Z" fill={p.earthShadow} opacity={0.3} />
          {/* Top-left light kiss / right-side core shadow (light from top-left). */}
          <Path
            d="M80 84 C90 130 108 166 126 184 C104 156 92 120 86 84 Z"
            fill="#FFFFFF"
            opacity={0.16}
          />
          <Path
            d="M246 84 C232 146 200 192 166 203 C196 198 224 156 238 96 Z"
            fill={p.earthShadow}
            opacity={0.35}
          />
          {/* Tip shading. */}
          <Ellipse cx={160} cy={198} fill={p.earthShadow} opacity={0.42} rx={18} ry={8} />

          {/* Dangling crystals, protruding BELOW the underside (asymmetric). */}
          <Path d="M128 190 L141 212 L128 238 L115 212 Z" fill={p.crystal} />
          <Path d="M128 190 L141 212 L128 238 Z" fill={p.crystalDeep} opacity={0.9} />
          <Path d="M122 198 L128 193 L128 226 L120 210 Z" fill="#FFFFFF" opacity={0.3} />
          <Path d="M196 186 L205 201 L196 221 L187 201 Z" fill={p.crystal} />
          <Path d="M196 186 L205 201 L196 221 Z" fill={p.crystalDeep} opacity={0.9} />

          {/* Clay lip (rim) + drips hanging over the cone. */}
          <Ellipse cx={160} cy={74} fill={p.rim} rx={108} ry={37} />
          <Ellipse cx={96} cy={102} fill={p.rim} rx={14} ry={16} />
          <Ellipse cx={154} cy={108} fill={p.rim} rx={16} ry={18} />
          <Ellipse cx={216} cy={100} fill={p.rim} rx={12} ry={14} />

          {/* Grass/clay top disc, lit from the top-left. */}
          <Ellipse cx={160} cy={62} fill={`url(#${idTop})`} rx={108} ry={37} />
          <Ellipse cx={116} cy={47} fill="#FFFFFF" opacity={0.26} rx={46} ry={12} />
        </Svg>
      </Animated.View>

      {/* Soft under-shadow blob floating below (does not bob). */}
      <Animated.View style={[styles.shadow, shadowStyle]}>
        <Svg height={shadowH} viewBox="0 0 100 20" width={shadowW}>
          <Defs>
            <RadialGradient cx="0.5" cy="0.5" id={idShadow} rx="0.5" ry="0.5">
              <Stop offset="0" stopColor={p.underShadow} />
              <Stop offset="1" stopColor={p.underShadow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={50} cy={10} fill={`url(#${idShadow})`} rx={50} ry={10} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
  },
  child: {
    alignItems: 'center',
    zIndex: 2,
  },
  shadow: {
    alignItems: 'center',
    marginTop: 12,
  },
});
