import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useSubjects } from '@/api/queries/subjects';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PressableScale } from '@/components/layout/PressableScale';
import type { Subject } from '@/api/types';
import { shade, withAlpha } from '@/lib/color';
import { getLucideIcon } from '@/lib/lucide';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, getSubjectAccent, radii, spacing, typography } from '@/theme/tokens';

/** formSheet modal: grid of accent-tinted subject clay tiles (§4a). */
export default function SubjectSwitcherRoute() {
  const { t } = useTranslation('map');
  const router = useRouter();
  const subjects = useSubjects();
  const activeSlug = useSettingsStore((s) => s.activeSubjectSlug);
  const setActiveSubjectSlug = useSettingsStore((s) => s.setActiveSubjectSlug);

  const select = (subject: Subject) => {
    setActiveSubjectSlug(subject.slug);
    router.back();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('switcher.title')}
        </Text>
        <ClayIconButton
          accessibilityLabel={t('switcher.close')}
          onPress={() => router.back()}
          size={44}
        >
          <X color={colors.neutral[700]} size={20} />
        </ClayIconButton>
      </View>

      {subjects.isPending ? (
        <View style={styles.grid}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton height={158} key={i} radius={radii.l} style={styles.gridItem} width="47%" />
          ))}
        </View>
      ) : subjects.isError ? (
        <ErrorState onRetry={() => void subjects.refetch()} retrying={subjects.isRefetching} />
      ) : (
        <FlatList
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.listContent}
          data={subjects.data}
          keyExtractor={(item) => item.slug}
          numColumns={2}
          renderItem={({ item }) => (
            <SubjectCard
              active={item.slug === activeSlug}
              onPress={() => select(item)}
              subject={item}
            />
          )}
        />
      )}
    </View>
  );
}

const RING_SIZE = 68;
const RING_STROKE = 4;

/** Completion ring around the subject icon (SVG arc, top-anchored). */
function CompletionRing({ pct, accent }: { pct: number; accent: string }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(pct, 100));
  return (
    <Svg
      height={RING_SIZE}
      pointerEvents="none"
      style={styles.ringSvg}
      width={RING_SIZE}
    >
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        fill="none"
        r={radius}
        stroke={withAlpha(accent, 0.18)}
        strokeWidth={RING_STROKE}
      />
      {clamped > 0 ? (
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          fill="none"
          r={radius}
          stroke={accent}
          strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
          strokeLinecap="round"
          strokeWidth={RING_STROKE}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      ) : null}
    </Svg>
  );
}

function SubjectCard({
  subject,
  active,
  onPress,
}: {
  subject: Subject;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation('map');
  const accent = getSubjectAccent(subject.slug, subject.color_hex);
  const Icon = getLucideIcon(subject.icon);
  const pct = subject.completion_pct;

  return (
    <PressableScale
      accessibilityLabel={subject.name}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={styles.gridItem}
      testID={`subject-card-${subject.slug}`}
    >
      <ClaySurface
        backgroundColor={withAlpha(accent, 0.08)}
        radius="l"
        shadow="none"
        style={[
          styles.card,
          { borderColor: withAlpha(accent, 0.2) },
          active && { borderColor: accent, borderWidth: 2.5, backgroundColor: withAlpha(accent, 0.12) },
        ]}
      >
        {active ? (
          <View style={[styles.checkBadge, { backgroundColor: accent }]}>
            <Check color={colors.neutral[0]} size={14} strokeWidth={3.5} />
          </View>
        ) : null}
        <View style={styles.iconWrap}>
          {typeof pct === 'number' ? <CompletionRing accent={accent} pct={pct} /> : null}
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: accent, borderBottomColor: shade(accent, -0.28) },
            ]}
          >
            <Icon color={colors.neutral[0]} size={24} strokeWidth={2.2} />
          </View>
        </View>
        <Text numberOfLines={1} style={styles.cardName}>
          {subject.name}
        </Text>
        {typeof pct === 'number' ? (
          <Text style={[styles.cardPct, { color: shade(accent, -0.32) }]}>
            {t('switcher.completed', { pct: Math.round(pct) })}
          </Text>
        ) : null}
      </ClaySurface>
    </PressableScale>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    marginBottom: spacing.l,
  },
  title: {
    ...typography.h1,
    fontFamily: typography.display.fontFamily,
    color: colors.neutral[900],
  },
  listContent: {
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xxl,
  },
  column: {
    gap: spacing.m,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    paddingHorizontal: spacing.l,
  },
  gridItem: {
    flex: 1,
    marginBottom: spacing.m,
  },
  card: {
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.m,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.s,
    right: spacing.s,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  cardName: {
    ...typography.bodyBold,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[900],
  },
  cardPct: {
    ...typography.caption,
    fontFamily: typography.h2.fontFamily,
  },
});
