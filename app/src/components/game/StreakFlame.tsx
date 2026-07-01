import { Flame } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, typography } from '@/theme/tokens';

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
      style={styles.row}
    >
      <Flame color={color} fill={active ? colors.streakOrange : 'transparent'} size={size} />
      <Text style={[styles.count, { color: active ? colors.streakOrange : colors.neutral[500] }]}>
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
