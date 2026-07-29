import { ChevronRight, Layers } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PressableScale } from '@/components/layout/PressableScale';
import { accentText, withAlpha } from '@/lib/color';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export const CHAPTER_BAR_HEIGHT = 38;

interface ChapterContextBarProps {
  /** 0-based position of the chapter currently filling the viewport. */
  index: number;
  total: number;
  title: string;
  done: number;
  levels: number;
  accent: string;
  /** Opens « Programme ». Also makes this the ONLY chapter control on screen. */
  onPress?: () => void;
}

/**
 * « Chapitre 3 · Immunologie » — which chapter the levels ON SCREEN belong to.
 *
 * The map is a single continuous path, and it is rendered bottom-to-top so the
 * climb reads upward. That reversal puts each chapter banner physically BELOW
 * the levels it introduces, which scanning top-to-bottom reads as a footer —
 * so once you had scrolled a screen away from a banner there was nothing left
 * telling you which chapter a node belonged to. The zone tint behind the rows
 * is deliberately faint (1.8–4.5% accent) and cannot carry that on its own.
 *
 * This bar is pinned under the map header and follows the scroll, so the
 * answer is always on screen. It is ALSO the entry point to « Programme »:
 * the header used to carry a separate "Chapitre 1/10" chip, which cost a whole
 * row and left two different chapter readouts disagreeing on screen (that chip
 * counts the chapter you have REACHED, this bar names the one you are LOOKING
 * at). One control, one number, one row.
 */
export function ChapterContextBar({
  index,
  total,
  title,
  done,
  levels,
  accent,
  onPress,
}: ChapterContextBarProps) {
  const { t } = useTranslation('map');
  const ink = accentText(accent);
  const pct = levels > 0 ? Math.round((done / levels) * 100) : 0;

  return (
    <PressableScale
      accessibilityHint={onPress ? t('chapters.hint') : undefined}
      accessibilityLabel={t('chapterBar.a11y', {
        index: index + 1,
        total,
        title,
        done,
        levels,
      })}
      accessibilityRole={onPress ? 'button' : 'text'}
      clay={false}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.bar, { backgroundColor: withAlpha(accent, 0.12) }]}
      testID="chapter-context-bar"
    >
      <Layers color={ink} size={14} strokeWidth={2.6} />
      <Text numberOfLines={1} style={[styles.label, { color: ink }]}>
        <Text style={styles.ordinal}>{t('chapterBar.ordinal', { index: index + 1 })}</Text>
        {'  ·  '}
        {title}
      </Text>
      <View style={styles.spacer} />
      {/* Progress is stated as a fraction, not colour alone (`color-not-only`). */}
      <Text style={[styles.count, { color: ink }]}>
        {t('unitProgress', { done, total: levels })}
      </Text>
      <View style={[styles.track, { backgroundColor: withAlpha(accent, 0.22) }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: accent }]} />
      </View>
      {onPress ? <ChevronRight color={ink} size={15} strokeWidth={2.8} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: CHAPTER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.m,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.m,
    borderRadius: radii.pill,
  },
  label: {
    ...typography.caption,
    fontFamily: typography.smallMedium.fontFamily,
    flexShrink: 1,
  },
  ordinal: {
    fontFamily: typography.h2.fontFamily,
    letterSpacing: 0.3,
  },
  spacer: {
    flexGrow: 1,
    minWidth: spacing.s,
  },
  count: {
    ...typography.caption,
    fontFamily: typography.h2.fontFamily,
    fontVariant: ['tabular-nums'],
  },
  track: {
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary[500],
  },
});
