import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MapUnit } from '@/api/types';
import { shade } from '@/lib/color';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';
import { UNIT_HEADER_HEIGHT } from '@/features/map/useMapLayout';

interface UnitHeaderProps {
  unit: MapUnit;
  done: number;
  total: number;
  accent: string;
}

/**
 * Rich unit banner separating units: subject-accent gradient, big Nunito
 * title, « n/m » progress pill, subtle pattern dots, clay bottom edge.
 */
export function UnitHeader({ unit, done, total, accent }: UnitHeaderProps) {
  const { t } = useTranslation('map');

  return (
    <View style={styles.row}>
      <View style={[styles.banner, { borderBottomColor: shade(accent, -0.3) }]}>
        <LinearGradient
          colors={[shade(accent, 0.08), shade(accent, -0.14)]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <PatternDots />
        <View style={styles.content}>
          <Text numberOfLines={1} style={styles.title}>
            {unit.title}
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t('unitProgress', { done, total })}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Faint white dot grid on the right half of the banner. */
function PatternDots() {
  return (
    <View pointerEvents="none" style={styles.dots}>
      {Array.from({ length: 3 }, (_, row) => (
        <View key={row} style={[styles.dotRow, row % 2 === 1 && styles.dotRowShift]}>
          {Array.from({ length: 6 }, (_, col) => (
            <View key={col} style={styles.dot} />
          ))}
        </View>
      ))}
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
    borderRadius: radii.l,
    borderBottomWidth: 4,
    overflow: 'hidden',
    ...shadows.clayRaised,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.l,
  },
  title: {
    ...typography.h2,
    fontFamily: typography.display.fontFamily,
    fontSize: 21,
    lineHeight: 26,
    color: colors.neutral[0],
    flexShrink: 1,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  pillText: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[0],
  },
  dots: {
    position: 'absolute',
    right: 76,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 7,
    opacity: 0.35,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dotRowShift: {
    marginLeft: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
});
