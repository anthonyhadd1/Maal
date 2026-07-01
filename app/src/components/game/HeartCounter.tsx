import { Heart, Infinity as InfinityIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPref } from '@/lib/motion';
import { colors, spacing, typography } from '@/theme/tokens';

interface HeartCounterProps {
  count: number;
  max?: number;
  size?: number;
  /** Premium / grace period: single heart + infinity, count ignored. */
  unlimited?: boolean;
  /** Single heart + number (sticky headers) instead of the full row. */
  compact?: boolean;
}

/**
 * Clay hearts. Full row: filled red for remaining, grey outline for lost —
 * losing one plays a scale-out + desaturate pop (reduced-motion aware).
 */
export function HeartCounter({
  count,
  max = 5,
  size = 20,
  unlimited = false,
  compact = false,
}: HeartCounterProps) {
  const { t } = useTranslation('common');
  const clamped = Math.max(0, Math.min(count, max));

  if (unlimited) {
    return (
      <View
        accessibilityLabel={t('hearts.unlimited')}
        accessibilityRole="text"
        style={styles.row}
        testID="hearts-unlimited"
      >
        <Heart color={colors.heartsRed} fill={colors.heartsRed} size={size} />
        <InfinityIcon color={colors.heartsRed} size={size} strokeWidth={2.6} />
      </View>
    );
  }

  if (compact) {
    const empty = clamped === 0;
    return (
      <View
        accessibilityLabel={t('a11y.hearts', { count: clamped, max })}
        accessibilityRole="text"
        style={styles.row}
      >
        <Heart
          color={empty ? colors.neutral[300] : colors.heartsRed}
          fill={empty ? 'transparent' : colors.heartsRed}
          size={size}
        />
        <Text style={[styles.count, { color: empty ? colors.neutral[500] : colors.heartsRed }]}>
          {clamped}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={t('a11y.hearts', { count: clamped, max })}
      accessibilityRole="text"
      style={styles.row}
    >
      {Array.from({ length: max }, (_, i) => (
        <AnimatedHeart filled={i < clamped} key={i} size={size} />
      ))}
    </View>
  );
}

/** One heart that pops (scale-out) and desaturates when it gets lost. */
function AnimatedHeart({ filled, size }: { filled: boolean; size: number }) {
  const reduceMotion = useReducedMotionPref();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const prevFilled = useRef(filled);

  useEffect(() => {
    if (prevFilled.current && !filled && !reduceMotion) {
      // Loss: quick scale-out pop, then settle greyed-out.
      scale.value = withSequence(
        withSpring(1.45, { damping: 12, stiffness: 320 }),
        withSpring(1, { damping: 14, stiffness: 260 }),
      );
      opacity.value = withSequence(withTiming(0.35, { duration: 140 }), withTiming(1, { duration: 260 }));
    }
    prevFilled.current = filled;
  }, [filled, reduceMotion, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Heart
        color={filled ? colors.heartsRed : colors.neutral[300]}
        fill={filled ? colors.heartsRed : 'transparent'}
        size={size}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  count: {
    ...typography.bodyBold,
  },
});
