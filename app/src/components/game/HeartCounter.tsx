import { Heart } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/theme/tokens';

interface HeartCounterProps {
  count: number;
  max?: number;
  size?: number;
}

/** Row of clay hearts: filled red for remaining, grey outline for lost. */
export function HeartCounter({ count, max = 5, size = 20 }: HeartCounterProps) {
  const { t } = useTranslation('common');
  const clamped = Math.max(0, Math.min(count, max));

  return (
    <View
      accessibilityLabel={t('a11y.hearts', { count: clamped, max })}
      accessibilityRole="text"
      style={styles.row}
    >
      {Array.from({ length: max }, (_, i) => (
        <Heart
          key={i}
          color={i < clamped ? colors.heartsRed : colors.neutral[300]}
          fill={i < clamped ? colors.heartsRed : 'transparent'}
          size={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
