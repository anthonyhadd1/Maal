import { Check, Crown, Lock, Play, Swords, type LucideIcon } from 'lucide-react-native';
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
import { useReducedMotionPref } from '@/lib/motion';
import { clayHighlight, colors, radii, shadows, spacing, typography } from '@/theme/tokens';
import { ROW_HEIGHT } from '@/features/map/useMapLayout';

export const NODE_SIZE = 76;
export const BOSS_NODE_SIZE = 88;

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

/** 76px clay sphere on the map path (88px for boss levels). */
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

  const { fill, iconColor, Icon } = nodeAppearance(visual, accent, isBoss, isLegendary);
  const left = x - size / 2;
  const top = (ROW_HEIGHT - size) / 2;
  const mascotOnLeft = x > rowWidth / 2;

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
      {visual === 'unlocked' ? <PulseRing size={size} accent={accent} left={left} top={top} /> : null}

      <Animated.View style={[styles.nodeWrap, { left, top }, shakeStyle]}>
        <PressableScale
          accessibilityLabel={a11yLabel}
          accessibilityState={{ disabled: visual === 'locked' }}
          onPress={handlePress}
          pressedTranslateY={3}
          style={[
            styles.node,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: fill,
              opacity: visual === 'locked' ? 0.6 : 1,
            },
          ]}
          testID={`level-node-${level.id}`}
        >
          <View
            pointerEvents="none"
            style={[styles.nodeHighlight, { width: size * 0.5, borderRadius: size / 4 }]}
          />
          <Icon
            color={iconColor}
            fill={visual === 'completed' || visual === 'unlocked' ? iconColor : 'transparent'}
            size={isBoss ? 34 : 28}
            strokeWidth={2.4}
          />
        </PressableScale>
      </Animated.View>

      {visual === 'completed' ? (
        <View pointerEvents="none" style={[styles.stars, { left: x - 36, top: top + size - 6 }]}>
          <StarRating size={16} stars={level.stars} />
        </View>
      ) : null}

      {isCurrent && visual === 'unlocked' ? (
        <>
          <StartTooltip label={t('startTooltip')} x={x} top={top} />
          <View
            pointerEvents="none"
            style={[
              styles.mascot,
              mascotOnLeft ? { left: left - 64 } : { left: left + size + 8 },
            ]}
          >
            <Mascot size={60} speed={0.6} state="idle" />
          </View>
        </>
      ) : null}
    </View>
  );
}

function nodeAppearance(
  visual: NodeVisual,
  accent: string,
  isBoss: boolean,
  isLegendary: boolean,
): { fill: string; iconColor: string; Icon: LucideIcon } {
  if (isLegendary) {
    // Gold crown skin — the legendary run has been earned on this level.
    return { fill: colors.xpGold, iconColor: colors.neutral[0], Icon: Crown };
  }
  switch (visual) {
    case 'premiumLocked':
      return { fill: colors.primary[500], iconColor: colors.neutral[0], Icon: Crown };
    case 'locked':
      return { fill: colors.neutral[300], iconColor: colors.neutral[500], Icon: Lock };
    case 'completed':
      return { fill: accent, iconColor: colors.neutral[0], Icon: isBoss ? Swords : Check };
    case 'unlocked':
    default:
      return { fill: accent, iconColor: colors.neutral[0], Icon: isBoss ? Swords : Play };
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

  const ringSize = size + 20;
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
          left: left - 10,
          top: top - 10,
        },
        ringStyle,
      ]}
    />
  );
}

/** Bobbing « COMMENCE » pill floating above the current node. */
function StartTooltip({ label, x, top }: { label: string; x: number; top: number }) {
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

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.tooltip, { left: x - 62, top: top - 32 }, bobStyle]}
    >
      <Text style={styles.tooltipText}>{label}</Text>
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
  nodeHighlight: {
    position: 'absolute',
    top: 6,
    height: 3,
    alignSelf: 'center',
    backgroundColor: clayHighlight,
  },
  ring: {
    position: 'absolute',
  },
  stars: {
    position: 'absolute',
    width: 72,
    alignItems: 'center',
  },
  mascot: {
    position: 'absolute',
    top: 20,
  },
  tooltip: {
    position: 'absolute',
    width: 124,
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.m,
    ...shadows.clayRaised,
  },
  tooltipText: {
    ...typography.caption,
    fontFamily: typography.caption.fontFamily,
    color: colors.primary[600],
    letterSpacing: 1,
  },
});
