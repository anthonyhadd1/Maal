import { Flame } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPref } from '@/lib/motion';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

export const COMBO_BADGE_THRESHOLD = 3;

/** Flame color escalates with the run (spec: shift at 5 and 8). */
export function comboColor(combo: number): string {
  if (combo >= 8) return colors.heartsRed;
  if (combo >= 5) return colors.streakOrange;
  return colors.xpGold;
}

interface ComboBadgeProps {
  combo: number;
}

/**
 * « x3 » flame pill by the progress bar from 3 consecutive correct answers,
 * popping on each increment, escalating color at 5 / 8.
 */
export function ComboBadge({ combo }: ComboBadgeProps) {
  const { t } = useTranslation('session');
  const reduceMotion = useReducedMotionPref();
  const scale = useSharedValue(1);
  const prevCombo = useRef(combo);

  useEffect(() => {
    if (combo > prevCombo.current && combo >= COMBO_BADGE_THRESHOLD && !reduceMotion) {
      scale.value = withSequence(
        withSpring(1.22, { damping: 9, stiffness: 400 }),
        withSpring(1, { damping: 13, stiffness: 320 }),
      );
    }
    prevCombo.current = combo;
  }, [combo, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (combo < COMBO_BADGE_THRESHOLD) return null;

  const color = comboColor(combo);

  return (
    <Animated.View
      accessibilityLabel={t('a11y.combo', { count: combo })}
      accessibilityRole="text"
      style={[styles.pill, animatedStyle]}
      testID="combo-badge"
    >
      <Flame color={color} fill={color} size={16} />
      <Text style={[styles.label, { color }]}>{t('combo.badge', { count: combo })}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    ...shadows.clayPressed,
  },
  label: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
  },
});
