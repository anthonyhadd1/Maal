import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSubjects } from '@/api/queries/subjects';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PressableScale } from '@/components/layout/PressableScale';
import type { Subject } from '@/api/types';
import { getLucideIcon } from '@/lib/lucide';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, getSubjectAccent, radii, spacing, typography } from '@/theme/tokens';

/** formSheet modal: grid of subject clay cards (design_mobile.md §4a). */
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
          size={40}
        >
          <X color={colors.neutral[700]} size={20} />
        </ClayIconButton>
      </View>

      {subjects.isPending ? (
        <View style={styles.grid}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton height={132} key={i} radius={radii.l} style={styles.gridItem} width="47%" />
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
        radius="l"
        shadow="none"
        style={[styles.card, active && { borderColor: accent, borderWidth: 2.5 }]}
      >
        <View style={[styles.iconBubble, { backgroundColor: accent }]}>
          <Icon color={colors.neutral[0]} size={26} strokeWidth={2.2} />
        </View>
        <Text numberOfLines={1} style={styles.cardName}>
          {subject.name}
        </Text>
        {typeof pct === 'number' ? (
          <Text style={[styles.cardPct, { color: accent }]}>
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
    borderColor: colors.neutral[100],
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    ...typography.bodyBold,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[900],
  },
  cardPct: {
    ...typography.caption,
  },
});
