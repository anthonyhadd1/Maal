import { Zap } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/format';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface XPBadgeProps {
  xp: number;
  size?: number;
}

/** Gold XP pill: bolt icon + formatted amount. */
export function XPBadge({ xp, size = 16 }: XPBadgeProps) {
  const { t } = useTranslation('common');

  return (
    <View accessibilityRole="text" style={styles.pill}>
      <Zap color={colors.xpGold} fill={colors.xpGold} size={size} />
      <Text style={styles.label}>{t('xp.total', { xp: formatNumber(xp) })}</Text>
    </View>
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
  },
  label: {
    ...typography.smallMedium,
    color: colors.neutral[900],
  },
});
