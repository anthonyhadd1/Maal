import { Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/theme/tokens';

interface StarRatingProps {
  /** 0..3 */
  stars: number;
  size?: number;
}

/** Level star rating: up to 3 gold stars, grey outline for the rest. */
export function StarRating({ stars, size = 20 }: StarRatingProps) {
  const { t } = useTranslation('common');
  const clamped = Math.max(0, Math.min(stars, 3));

  return (
    <View
      accessibilityLabel={t('a11y.stars', { count: clamped })}
      accessibilityRole="text"
      style={styles.row}
    >
      {Array.from({ length: 3 }, (_, i) => (
        <Star
          key={i}
          color={i < clamped ? colors.xpGold : colors.neutral[300]}
          fill={i < clamped ? colors.xpGold : 'transparent'}
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
