import { useRouter } from 'expo-router';
import { Check, ChevronRight, Lock, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useSubjectMap } from '@/api/queries/map';
import { buildChapters, type ChapterVM } from '@/features/map/chapters';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PressableScale } from '@/components/layout/PressableScale';
import { accentText, withAlpha } from '@/lib/color';
import { useReducedMotionPref } from '@/lib/motion';
import { useMapNavStore } from '@/stores/mapNavStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, getSubjectAccent, radii, spacing, typography } from '@/theme/tokens';

/**
 * « Programme » — the subject's chapters as a readable syllabus.
 *
 * This replaces a ClayDialog that held the chapter list. A chapter list is
 * primary navigation, not a confirmation, and Apple's HIG is explicit that
 * modals must not carry primary navigation — it also meant the app's peer
 * navigation concepts were wildly inconsistent (subjects got a full designed
 * route of clay cards; chapters got flat rows in a 360pt-tall scroll box).
 *
 * The design leans on the app's existing clay depth rather than adding a new
 * visual language: a numbered progress ring per chapter (same ring idiom as
 * the subject switcher), a connecting spine that makes the syllabus read as
 * one continuous climb, and exactly ONE emphasised card — the chapter the
 * student is actually on.
 */
export function ChaptersScreen() {
  const { t } = useTranslation('map');
  const router = useRouter();
  const reduceMotion = useReducedMotionPref();

  const activeSlug = useSettingsStore((s) => s.activeSubjectSlug);
  const requestJumpToUnit = useMapNavStore((s) => s.requestJumpToUnit);
  const map = useSubjectMap(activeSlug);

  const accent = getSubjectAccent(activeSlug ?? '', map.data?.subject.color_hex);
  const chapters = useMemo(() => buildChapters(map.data?.units ?? []), [map.data?.units]);

  const doneChapters = chapters.filter((c) => c.state === 'completed').length;
  const totalChapters = chapters.length;
  const pct = totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0;

  const open = (chapter: ChapterVM) => {
    requestJumpToUnit(chapter.id);
    router.back();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('chapters.title')}
          </Text>
          <Text style={styles.subtitle}>
            {map.data?.subject.name ?? ''}
          </Text>
        </View>
        <ClayIconButton
          accessibilityLabel={t('chapters.close')}
          onPress={() => router.back()}
          size={44}
        >
          <X color={colors.neutral[700]} size={22} />
        </ClayIconButton>
      </View>

      {/* Overall progress — the one number that answers "where am I?" before
          the student reads a single chapter title. */}
      {totalChapters > 0 ? (
        <View
          accessibilityLabel={t('chapters.overallA11y', {
            done: doneChapters,
            total: totalChapters,
          })}
          accessible
          style={styles.overall}
        >
          <View style={styles.overallRow}>
            <Text style={styles.overallLabel}>
              {t('chapters.overall', { done: doneChapters, total: totalChapters })}
            </Text>
            <Text style={[styles.overallPct, { color: accentText(accent) }]}>{pct}%</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[styles.trackFill, { width: `${pct}%`, backgroundColor: accent }]}
            />
          </View>
        </View>
      ) : null}

      {map.isPending ? (
        <View style={styles.skeletonWrap}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton height={92} key={i} radius={radii.l} width="100%" />
          ))}
        </View>
      ) : map.isError ? (
        <ErrorState onRetry={() => void map.refetch()} retrying={map.isRefetching} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          testID="chapters-list"
        >
          {chapters.map((chapter, i) => (
            <Animated.View
              entering={
                reduceMotion
                  ? undefined
                  : // 40ms stagger: the syllabus assembles top-down instead of
                    // snapping in as one block (Material stagger-sequence).
                    FadeInDown.delay(Math.min(i, 8) * 40)
                      .duration(260)
                      .springify()
                      .damping(18)
              }
              key={chapter.id}
            >
              <ChapterCard
                accent={accent}
                chapter={chapter}
                isLast={i === chapters.length - 1}
                onPress={() => open(chapter)}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** Gap between chapter cards — also the exact height of the connecting spine. */
const GAP = 14;

const RING = 44;
const RING_STROKE = 3.5;
const RING_RADIUS = (RING - RING_STROKE) / 2;
const RING_CIRCUM = 2 * Math.PI * RING_RADIUS;

/** Numbered progress ring — same idiom as the subject switcher's completion
 *  ring, so the two navigation surfaces read as one family. */
function ChapterRing({
  chapter,
  accent,
}: {
  chapter: ChapterVM;
  accent: string;
}) {
  const fraction = chapter.total > 0 ? Math.min(1, chapter.done / chapter.total) : 0;
  const isLocked = chapter.state === 'locked';
  const isDone = chapter.state === 'completed';
  const ringColor = isLocked ? colors.neutral[300] : accent;

  return (
    <View style={styles.ringWrap}>
      <Svg height={RING} width={RING}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          fill="none"
          r={RING_RADIUS}
          stroke={isLocked ? colors.neutral[200] : withAlpha(accent, 0.18)}
          strokeWidth={RING_STROKE}
        />
        {fraction > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            fill="none"
            r={RING_RADIUS}
            stroke={ringColor}
            strokeDasharray={`${RING_CIRCUM * fraction} ${RING_CIRCUM}`}
            strokeLinecap="round"
            strokeWidth={RING_STROKE}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        ) : null}
      </Svg>
      <View pointerEvents="none" style={styles.ringCenter}>
        {isDone ? (
          <Check color={accentText(accent)} size={18} strokeWidth={3.2} />
        ) : isLocked ? (
          <Lock color={colors.neutral[500]} size={15} strokeWidth={2.6} />
        ) : (
          <Text style={[styles.ringNumber, { color: accentText(accent) }]}>
            {chapter.index + 1}
          </Text>
        )}
      </View>
    </View>
  );
}

function ChapterCard({
  chapter,
  accent,
  isLast,
  onPress,
}: {
  chapter: ChapterVM;
  accent: string;
  isLast: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation('map');
  const isCurrent = chapter.state === 'current';
  const isLocked = chapter.state === 'locked';
  const isDone = chapter.state === 'completed';
  const fractionPct = chapter.total > 0 ? (chapter.done / chapter.total) * 100 : 0;

  const statusLabel = isDone
    ? t('chapters.state.completed')
    : isCurrent
      ? t('chapters.state.current')
      : isLocked
        ? t('chapters.state.locked')
        : t('chapters.progress', { done: chapter.done, total: chapter.total });

  // One label carrying number + title + progress + state: a screen reader user
  // otherwise hears only the title and loses everything the ring encodes.
  const a11yLabel = t('chapters.cardA11y', {
    index: chapter.index + 1,
    title: chapter.title,
    done: chapter.done,
    total: chapter.total,
    status: statusLabel,
  });

  return (
    <View style={styles.row}>
      {/* Spine: ties the rings into one continuous climb. Purely decorative,
          so it is hidden from screen readers. */}
      {!isLast ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.spine, { backgroundColor: isDone ? withAlpha(accent, 0.35) : colors.neutral[200] }]}
        />
      ) : null}

      <PressableScale
        accessibilityLabel={a11yLabel}
        accessibilityRole="button"
        onPress={onPress}
        pressedTranslateY={2}
        style={styles.pressable}
        testID={`chapter-card-${chapter.id}`}
      >
        <ClaySurface
          backgroundColor={isCurrent ? withAlpha(accent, 0.09) : colors.neutral[0]}
          radius="l"
          shadow={isCurrent ? 'raised' : 'none'}
          style={[
            styles.card,
            {
              borderColor: isCurrent ? accent : colors.neutral[200],
              borderWidth: isCurrent ? 2 : 1,
            },
            isLocked && styles.cardLocked,
          ]}
        >
          <ChapterRing accent={accent} chapter={chapter} />

          <View style={styles.cardBody}>
            <Text numberOfLines={2} style={[styles.cardTitle, isLocked && styles.mutedText]}>
              {chapter.title}
            </Text>

            <View style={styles.metaRow}>
              <Text
                style={[
                  styles.status,
                  isCurrent && { color: accentText(accent) },
                  isDone && { color: accentText(accent) },
                  isLocked && styles.mutedText,
                ]}
              >
                {statusLabel}
              </Text>
              {isCurrent && chapter.total > 0 ? (
                <Text style={styles.count}>
                  {chapter.done}/{chapter.total}
                </Text>
              ) : null}
            </View>

            {/* Progress bar only where progress is meaningful — a full or empty
                bar on every card is noise, not information. */}
            {!isLocked && !isDone && fractionPct > 0 ? (
              <View style={styles.miniTrack}>
                <View
                  style={[
                    styles.miniFill,
                    { width: `${fractionPct}%`, backgroundColor: accent },
                  ]}
                />
              </View>
            ) : null}
          </View>

          <ChevronRight
            color={isLocked ? colors.neutral[300] : colors.neutral[500]}
            size={20}
            strokeWidth={2.4}
          />
        </ClaySurface>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    paddingTop: spacing.l,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.m,
    paddingHorizontal: spacing.l,
  },
  headerText: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    ...typography.h1,
    fontFamily: typography.display.fontFamily,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.smallMedium,
    color: colors.neutral[500],
  },
  overall: {
    paddingHorizontal: spacing.l,
    marginTop: spacing.l,
    gap: spacing.s,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  overallLabel: {
    ...typography.smallMedium,
    color: colors.neutral[700],
  },
  overallPct: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
  },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[200],
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  skeletonWrap: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
    gap: spacing.m,
  },
  listContent: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  row: {
    position: 'relative',
    paddingBottom: GAP,
  },
  /** Runs from just under this card's ring to the next card's ring. */
  spine: {
    position: 'absolute',
    left: spacing.l + RING / 2 - 1,
    bottom: 0,
    height: GAP,
    width: 2,
    borderRadius: 1,
  },
  pressable: {
    borderRadius: radii.l,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.l,
    minHeight: 88,
  },
  cardLocked: {
    backgroundColor: colors.neutral[50],
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.bodyBold,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[900],
  },
  mutedText: {
    color: colors.neutral[500],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s,
  },
  status: {
    ...typography.caption,
    fontFamily: typography.smallMedium.fontFamily,
    color: colors.neutral[500],
  },
  count: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  miniTrack: {
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[200],
    overflow: 'hidden',
    marginTop: 2,
  },
  miniFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  ringWrap: {
    width: RING,
    height: RING,
    flexShrink: 0,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNumber: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
  },
});
