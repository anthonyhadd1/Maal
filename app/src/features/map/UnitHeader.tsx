import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MapUnit } from '@/api/types';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { colors, overlayLight, radii, spacing, typography } from '@/theme/tokens';
import { UNIT_HEADER_HEIGHT } from '@/features/map/useMapLayout';

interface UnitHeaderProps {
  unit: MapUnit;
  done: number;
  total: number;
  accent: string;
}

/** Full-width clay banner separating units: title + « n/m » progress pill. */
export function UnitHeader({ unit, done, total, accent }: UnitHeaderProps) {
  const { t } = useTranslation('map');

  return (
    <View style={styles.row}>
      <ClaySurface backgroundColor={accent} radius="l" style={styles.banner}>
        <Text numberOfLines={1} style={styles.title}>
          {unit.title}
        </Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{t('unitProgress', { done, total })}</Text>
        </View>
      </ClaySurface>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: UNIT_HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.l,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[0],
    flexShrink: 1,
  },
  pill: {
    backgroundColor: overlayLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  pillText: {
    ...typography.smallMedium,
    color: colors.neutral[0],
  },
});
