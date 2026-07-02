import { Crown, Lock, Star, Swords, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { MapLevel } from '@/api/types';
import { StarRating } from '@/components/game/StarRating';
import { PressableScale } from '@/components/layout/PressableScale';
import { Mascot } from '@/components/mascot/Mascot';
import { shade } from '@/lib/color';
import { useReducedMotionPref } from '@/lib/motion';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';
import { ROW_HEIGHT } from '@/features/map/useMapLayout';

export const NODE_SIZE = 78;
export const BOSS_NODE_SIZE = 90;
/** Darker bottom lip that gives the sphere its clay depth. */
const NODE_EDGE = 6;

export type NodeVisual = 'locked' | 'premiumLocked' | 'unlocked' | 'completed';

/** Visual state per design_mobile.md §4a — premium gate wins over lock state. */
export function nodeVisual(level: MapLevel): NodeVisual {
  if (!level.is_free_for_me) return 'premiumLocked';
  if (level.status === 'locked') return 'locked';
  if (level.status === 'completed') return 'completed';
  return 'unlocked';
}

/**
 * A press on this node should offer the legendary run (gameplay doc §1.5):
 * playable, completed with the full 3 stars, crown not yet earned.
 */
export function offersLegendary(level: MapLevel): boolean {
  return nodeVisual(level) === 'completed' && level.stars >= 3 && !level.is_legendary;
}

interface LevelNodeProps {
  level: MapLevel;
  accent: string;
  /** Node center x within the row (from useMapLayout). */
  x: number;
  rowWidth: number;
  /** COMMENCE tooltip + idle mascot appear on the current node only. */
  isCurrent: boolean;
  onStart: (level: MapLevel) => void;
  onLocked: (level: MapLevel) => void;
  onPremium: (level: MapLevel) => void;
}

/**
 * Layered clay sphere on the map path: accent face + darker bottom lip,
 * inner tinted circle hosting the icon, star pips under completed nodes.
 */
export function LevelNode({
  level,
  accent,
  x,
  rowWidth,
  isCurrent,
  onStart,
  onLocked,
  onPremium,
}: LevelNodeProps) {
  const { t } = useTranslation('map');
  const reduceMotion = useReducedMotionPref();
  const visual = nodeVisual(level);
  const isBoss = !!level.is_boss;
  const isLegendary = !!level.is_legendary && visual === 'completed';
  const size = isBoss ? BOSS_NODE_SIZE : NODE_SIZE;

  const shakeX = useSharedValue(0);

  const shake = () => {
    if (reduceMotion) return;
    shakeX.value = withSequence(
      withTiming(-7, { duration: 55 }),
      withTiming(7, { duration: 55 }),
      withTiming(-5, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
  };

  const handlePress = () => {
    if (visual === 'premiumLocked') {
      onPremium(level);
      return;
    }
    if (visual === 'locked') {
      shake();
      onLocked(level);
      return;
    }
    onStart(level);
  };

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const a = nodeAppearance(visual, accent, isBoss, isLegendary);
  const left = x - size / 2;
  const top = (ROW_HEIGHT - size - NODE_EDGE) / 2;
  const mascotOnLeft = x > rowWidth / 2;
  const innerSize = Math.round(size * 0.68);

  // Live-state label: title + status (+ stars when completed), i18n'd.
  const a11yKey = isLegendary
    ? 'a11y.nodeLegendary'
    : visual === 'completed'
      ? 'a11y.nodeCompleted'
      : visual === 'locked'
        ? 'a11y.nodeLocked'
        : visual === 'premiumLocked'
          ? 'a11y.nodePremium'
          : 'a11y.nodeUnlocked';
  const a11yLabel = `${t(a11yKey, { title: level.title, stars: level.stars })}${
    isBoss ? ` — ${t('boss')}` : ''
  }`;

  return (
    <View pointerEvents="box-none" style={styles.rowFill}>
      {visual === 'unlocked' ? (
        <PulseRing accent={accent} left={left} size={size} top={top} />
      ) : null}

      <Animated.View style={[styles.nodeWrap, { left, top }, shakeStyle]}>
        <PressableScale
          accessibilityLabel={a11yLabel}
          accessibilityState={{ disabled: visual === 'locked' }}
          onPress={handlePress}
          pressedTranslateY={NODE_EDGE - 2}
          style={[
            styles.node,
            {
              width: size,
              height: size + NODE_EDGE,
              borderRadius: size / 2,
              backgroundColor: a.fill,
              borderBottomWidth: NODE_EDGE,
              borderBottomColor: a.edge,
            },
          ]}
          testID={`level-node-${level.id}`}
        >
          {/* Top sheen — moulded volume, not a hairline. */}
          <View
            pointerEvents="none"
            style={[
              styles.nodeSheen,
              {
                width: size * 0.52,
                height: size * 0.18,
                borderRadius: size / 3,
                opacity: visual === 'locked' ? 0.5 : 1,
              },
            ]}
          />
          {/* Inner tinted circle hosting the icon. */}
          <View
            style={[
              styles.inner,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
                backgroundColor: a.innerFill,
              },
            ]}
          >
            <a.Icon
              color={a.iconColor}
              fill={a.iconFilled ? a.iconColor : 'transparent'}
              size={isBoss ? 36 : 30}
              strokeWidth={2.4}
            />
          </View>
        </PressableScale>
      </Animated.View>

      {visual === 'completed' ? (
        <View
          pointerEvents="none"
          style={[styles.starsPill, { left: x - 40, top: top + size - 10 }]}
        >
          <View style={styles.starsInner}>
            <StarRating size={13} stars={level.stars} />
          </View>
        </View>
      ) : null}

      {isCurrent && visual === 'unlocked' ? (
        <>
          <StartTooltip accent={accent} label={t('startTooltip')} rowWidth={rowWidth} top={top} x={x} />
          <View
            pointerEvents="none"
            style={[
              styles.mascot,
              mascotOnLeft ? { left: left - 66 } : { left: left + size + 8 },
            ]}
          >
            <Mascot size={60} speed={0.6} state="idle" />
          </View>
        </>
      ) : null}
    </View>
  );
}

interface NodeSkin {
  fill: string;
  edge: string;
  innerFill: string;
  iconColor: string;
  iconFilled: boolean;
  Icon: LucideIcon;
}

function nodeAppearance(
  visual: NodeVisual,
  accent: string,
  isBoss: boolean,
  isLegendary: boolean,
): NodeSkin {
  if (isLegendary) {
    // Gold crown skin — the legendary run has been earned on this level.
    return {
      fill: colors.xpGold,
      edge: colors.goldDeep,
      innerFill: 'rgba(255, 255, 255, 0.24)',
      iconColor: colors.neutral[0],
      iconFilled: true,
      Icon: Crown,
    };
  }
  switch (visual) {
    case 'premiumLocked':
      return {
        fill: colors.primary[500],
        edge: colors.primary[700],
        innerFill: 'rgba(255, 255, 255, 0.2)',
        iconColor: colors.neutral[0],
        iconFilled: false,
        Icon: Crown,
      };
    case 'locked':
      return {
        fill: colors.neutral[200],
        edge: colors.neutral[300],
        innerFill: colors.neutral[100],
        iconColor: colors.neutral[500],
        iconFilled: false,
        Icon: Lock,
      };
    case 'completed':
      return {
        fill: accent,
        edge: shade(accent, -0.32),
        innerFill: 'rgba(255, 255, 255, 0.22)',
        iconColor: colors.neutral[0],
        iconFilled: true,
        Icon: isBoss ? Swords : Star,
      };
    case 'unlocked':
    default:
      return {
        fill: accent,
        edge: shade(accent, -0.32),
        innerFill: 'rgba(255, 255, 255, 0.22)',
        iconColor: colors.neutral[0],
        iconFilled: true,
        Icon: isBoss ? Swords : Star,
      };
  }
}

/** Soft accent ring breathing behind an unlocked node. */
function PulseRing({
  size,
  accent,
  left,
  top,
}: {
  size: number;
  accent: string;
  left: number;
  top: number;
}) {
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
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          backgroundColor: accent,
          left: left - 11,
          top: top - 8,
        },
        ringStyle,
      ]}
    />
  );
}

/** Bobbing « COMMENCE » clay bubble (with tail) above the current node. */
function StartTooltip({
  label,
  accent,
  x,
  top,
  rowWidth,
}: {
  label: string;
  accent: string;
  x: number;
  top: number;
  rowWidth: number;
}) {
  const reduceMotion = useReducedMotionPref();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    bob.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    return () => cancelAnimation(bob);
  }, [bob, reduceMotion]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * -5 }],
  }));

  // Clamp the bubble inside the row (nodes near the wave edges).
  const left = Math.min(Math.max(spacing.s, x - 62), rowWidth - 124 - spacing.s);

  return (
    <Animated.View pointerEvents="none" style={[styles.tooltipWrap, { left, top: top - 34 }, bobStyle]}>
      <View style={styles.tooltip}>
        <Text style={[styles.tooltipText, { color: shade(accent, -0.35) }]}>{label}</Text>
      </View>
      <View style={styles.tooltipTail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  nodeWrap: {
    position: 'absolute',
  },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeSheen: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  starsPill: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
    zIndex: 3,
  },
  starsInner: {
    backgroundColor: colors.neutral[0],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.s,
    paddingVertical: 3,
    ...shadows.clayPressed,
  },
  mascot: {
    position: 'absolute',
    top: 22,
  },
  tooltipWrap: {
    position: 'absolute',
    width: 124,
    alignItems: 'center',
  },
  tooltip: {
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.m,
    ...shadows.clayRaised,
  },
  tooltipTail: {
    width: 12,
    height: 12,
    marginTop: -7,
    backgroundColor: colors.neutral[0],
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  tooltipText: {
    ...typography.caption,
    fontFamily: typography.h2.fontFamily,
    letterSpacing: 1.2,
  },
});
