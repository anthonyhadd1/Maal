import { LinearGradient } from 'expo-linear-gradient';
import { ChevronsUp } from 'lucide-react-native';
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
  /** 0-based position of this chapter in the subject. */
  unitIndex: number;
}

/**
 * Chapter gate on the path: subject-accent gradient, « CHAPITRE N » eyebrow,
 * big Nunito title, « n/m » progress pill, pattern dots, clay bottom edge.
 *
 * The map renders bottom-to-top, so this banner sits physically BELOW the
 * levels it introduces and you climb up THROUGH it into them. Scanning the
 * screen downwards that reads like a footer for the wrong chapter, so the
 * banner states its own number explicitly and points upward — it announces
 * "chapter N starts here and continues above" rather than relying on position.
 */
export function UnitHeader({ unit, done, total, accent, unitIndex }: UnitHeaderProps) {
  const { t } = useTranslation('map');

  return (
    <View style={styles.row}>
      <View style={[styles.banner, { borderBottomColor: shade(accent, -0.3) }]}>
        <LinearGradient
          colors={[shade(accent, -0.35), shade(accent, -0.55)]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <PatternDots />
        <View style={styles.content}>
          <View style={styles.titleCol}>
            <View style={styles.eyebrowRow}>
              <ChevronsUp color="rgba(255,255,255,0.92)" size={13} strokeWidth={2.8} />
              <Text style={styles.eyebrow}>
                {t('chapterBar.ordinal', { index: unitIndex + 1 })}
              </Text>
            </View>
            <Text numberOfLines={2} style={styles.title}>
              {unit.title}
            </Text>
          </View>
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
    paddingHorizontal: spacing.m,
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
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  titleCol: {
    flexShrink: 1,
    gap: 2,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  eyebrow: {
    ...typography.caption,
    fontFamily: typography.h2.fontFamily,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.92)',
  },
  title: {
    ...typography.h2,
    fontFamily: typography.display.fontFamily,
    fontSize: 15,
    lineHeight: 19,
    color: colors.neutral[0],
    flexShrink: 1,
  },
  pill: {
    flexShrink: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.s,
    paddingVertical: 3,
  },
  pillText: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[900],
  },
  dots: {
    position: 'absolute',
    right: 64,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 7,
    opacity: 0.28,
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
