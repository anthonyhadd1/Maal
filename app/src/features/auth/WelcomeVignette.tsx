import { Lock, Star } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Mascot } from '@/components/mascot/Mascot';
import { Ember } from '@/features/scenes/Ember';
import { withAlpha } from '@/lib/color';
import { useReducedMotionPref } from '@/lib/motion';
import { colors } from '@/theme/tokens';

/**
 * Path + node constants copied from features/map (MapConnector.tsx STROKE /
 * RIBBON_STROKE / RIBBON_OPACITY, LevelNode.tsx NODE_EDGE) — deliberately
 * NOT imported: auth must not couple to map layout internals. If the map's
 * visual language changes, update these mirrors by hand.
 */
const PATH_STROKE = 8;
const RIBBON_STROKE = 14;
const RIBBON_OPACITY = 0.1;
const NODE_EDGE = 6;

/** Fixed vignette heights — every internal position is a fraction of W/H. */
const HEIGHT = 260;
const HEIGHT_SHORT = 200;
const MASCOT = 132;
const MASCOT_SHORT = 112;

interface WelcomeVignetteProps {
  /** Rendered width — all x-positions are fractions of it (no measurement). */
  width: number;
  /** Short-screen degrade: smaller canvas + mascot, same fractions. */
  short: boolean;
}

/**
 * "Le départ" — the phoenix chick standing at level 1 of a glowing path that
 * rises into the dark: the game's REAL map language (clay spheres, dashed
 * road) miniaturized into a promise. Purely decorative: the support line
 * below carries the meaning, so the whole canvas is a11y-hidden.
 * All positions are fractions of W/H — no onLayout, no measurement (the web
 * preview harness never fires onLayout on this flow).
 */
export function WelcomeVignette({ width: W, short }: WelcomeVignetteProps) {
  const reduceMotion = useReducedMotionPref();
  const H = short ? HEIGHT_SHORT : HEIGHT;
  const mascotSize = short ? MASCOT_SHORT : MASCOT;

  // Entrance: the canvas floats up while fading in; the mascot fades in a
  // beat later (its idle bob is Mascot-internal). Reduced motion starts both
  // at their final state and never animates.
  const enterProgress = useSharedValue(reduceMotion ? 1 : 0);
  const mascotOpacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      // Snap to the final state: if the pref flips ON mid-entrance, the
      // previous effect's cleanup cancelled the animation and would otherwise
      // freeze the canvas semi-transparent/offset.
      enterProgress.value = 1;
      mascotOpacity.value = 1;
      return;
    }
    enterProgress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    mascotOpacity.value = withDelay(300, withTiming(1, { duration: 260 }));
    return () => {
      cancelAnimation(enterProgress);
      cancelAnimation(mascotOpacity);
    };
  }, [enterProgress, mascotOpacity, reduceMotion]);

  const canvasStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
    transform: [{ translateY: 14 * (1 - enterProgress.value) }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({ opacity: mascotOpacity.value }));

  // Node centers (fractions of W/H): start node low-center, the locked path
  // climbing away into the dark.
  const start = { x: 0.62 * W, y: 0.82 * H };
  const n2 = { x: 0.8 * W, y: 0.42 * H };
  const n3 = { x: 0.56 * W, y: 0.12 * H };

  // Two quadratic segments in MapConnector's exact language: control point =
  // segment midpoint nudged 0.12W sideways (alternating, so the road winds).
  const seg1 = `M ${start.x} ${start.y} Q ${(start.x + n2.x) / 2 - 0.12 * W} ${
    (start.y + n2.y) / 2
  } ${n2.x} ${n2.y}`;
  const seg2 = `M ${n2.x} ${n2.y} Q ${(n2.x + n3.x) / 2 + 0.12 * W} ${
    (n2.y + n3.y) / 2
  } ${n3.x} ${n3.y}`;

  return (
    <Animated.View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width: W, height: H }, canvasStyle]}
      testID="welcome-vignette"
    >
      <Svg height={H} style={StyleSheet.absoluteFill} width={W}>
        {/* Soft ribbon "road" + dashed stroke to the next level (the map's
            locked-target vocabulary), fading with distance into the dark. */}
        <Path
          d={seg1}
          fill="none"
          stroke={colors.primary[500]}
          strokeLinecap="round"
          strokeOpacity={RIBBON_OPACITY}
          strokeWidth={RIBBON_STROKE}
        />
        <Path
          d={seg1}
          fill="none"
          stroke={withAlpha(colors.neutral[0], 0.34)}
          strokeDasharray={[1, 16]}
          strokeLinecap="round"
          strokeWidth={PATH_STROKE}
        />
        <Path
          d={seg2}
          fill="none"
          stroke={withAlpha(colors.neutral[0], 0.22)}
          strokeDasharray={[1, 16]}
          strokeLinecap="round"
          strokeWidth={PATH_STROKE}
        />
      </Svg>

      <PulseRing cx={start.x} cy={start.y} size={64} />
      {/* Entrance order start → n2 → n3 (delays 150 + i×110). */}
      <MiniNode cx={n3.x} cy={n3.y} delay={370} locked reduceMotion={reduceMotion} size={36} />
      <MiniNode
        cx={n2.x}
        cy={n2.y}
        delay={260}
        icon="lock"
        locked
        reduceMotion={reduceMotion}
        size={48}
      />
      <MiniNode cx={start.x} cy={start.y} delay={150} icon="star" reduceMotion={reduceMotion} size={64} />

      <Animated.View
        style={[
          styles.mascotWrap,
          { left: 0.04 * W, width: mascotSize, height: mascotSize },
          mascotStyle,
        ]}
      >
        {/* Two embers rising off the crest — Ember self-removes under reduced
            motion; the ground shadow is built into Mascot. */}
        <Ember
          color={colors.xpGoldLight}
          drift={6}
          durationMs={2800}
          riseHeight={40}
          size={5}
          x={0.5 * mascotSize}
          y={8}
        />
        <Ember
          color={colors.streakOrange}
          delayMs={900}
          durationMs={3400}
          riseHeight={48}
          size={4}
          x={0.62 * mascotSize}
          y={12}
        />
        <Mascot size={mascotSize} state="idle" />
      </Animated.View>
    </Animated.View>
  );
}

interface MiniNodeProps {
  cx: number;
  cy: number;
  size: number;
  delay: number;
  reduceMotion: boolean;
  locked?: boolean;
  /** n3 is too small to render an icon honestly — it gets none. */
  icon?: 'star' | 'lock';
}

/**
 * View-based clay sphere copying LevelNode's recipe exactly (accent face +
 * darker bottom lip, top sheen, 68% inner circle hosting the icon) — kept
 * local to auth on purpose; see the constants note at the top of this file.
 */
function MiniNode({ cx, cy, size, delay, reduceMotion, locked = false, icon }: MiniNodeProps) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      // Final state, not a bare return — see the entrance effect above.
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) }),
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, delay]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1),
    transform: [{ scale: 0.8 + progress.value * 0.2 }],
  }));

  const fill = locked ? colors.neutral[200] : colors.primary[500];
  const edge = locked ? colors.neutral[300] : colors.primary[700];
  const innerFill = locked ? colors.neutral[100] : 'rgba(255, 255, 255, 0.22)';
  const innerSize = Math.round(size * 0.68);

  return (
    <Animated.View
      style={[
        styles.node,
        {
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size + NODE_EDGE,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderBottomWidth: NODE_EDGE,
          borderBottomColor: edge,
        },
        enterStyle,
      ]}
    >
      {/* Top sheen — moulded volume, not a hairline (LevelNode's 0.52×/0.18×). */}
      <View
        pointerEvents="none"
        style={[
          styles.sheen,
          {
            width: size * 0.52,
            height: size * 0.18,
            borderRadius: size / 3,
            top: Math.round(size * 0.08),
          },
        ]}
      />
      <View
        style={[
          styles.inner,
          { width: innerSize, height: innerSize, borderRadius: innerSize / 2, backgroundColor: innerFill },
        ]}
      >
        {icon === 'star' ? (
          <Star color={colors.neutral[0]} fill={colors.neutral[0]} size={26} strokeWidth={2.4} />
        ) : null}
        {icon === 'lock' ? <Lock color={colors.neutral[500]} size={18} strokeWidth={2.4} /> : null}
      </View>
    </Animated.View>
  );
}

/**
 * Local copy of LevelNode's PulseRing (breathing halo behind the playable
 * node) — same values, static at the mid-pulse frame under reduced motion.
 */
function PulseRing({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const reduceMotion = useReducedMotionPref();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.4;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 0.45 - pulse.value * 0.25,
  }));

  const ringSize = size + 22;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          left: cx - ringSize / 2,
          top: cy - ringSize / 2,
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
        },
        ringStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheen: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    backgroundColor: colors.primary[400],
  },
  mascotWrap: {
    position: 'absolute',
    bottom: 4,
  },
});
