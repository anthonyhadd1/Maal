import { Flame } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, typography } from '@/theme/tokens';
import { tints } from '@/theme/tints';

interface StreakFlameProps {
  days: number;
  size?: number;
}

/** Streak flame + day count. Grey when the streak is at 0. */
export function StreakFlame({ days, size = 20 }: StreakFlameProps) {
  const { t } = useTranslation('common');
  const active = days > 0;
  const color = active ? colors.streakOrange : colors.neutral[300];

  return (
    <View
      accessibilityLabel={`${t('streak.label')} : ${t('streak.days', { count: days })}`}
      accessibilityRole="text"
      accessible
      style={styles.row}
    >
      {/* The flame keeps #F97316 — as a filled shape it carries the warmth.
          The NUMBER can't: orange-on-white is 2.50:1, so it uses the deeper
          flame foreground the tint scale already defines. */}
      <Flame color={color} fill={active ? colors.streakOrange : 'transparent'} size={size} />
      <Text style={[styles.count, { color: active ? tints.flameText : colors.neutral[500] }]}>
        {days}
      </Text>
    </View>
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
