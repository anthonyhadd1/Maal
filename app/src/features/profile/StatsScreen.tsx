import { useRouter } from 'expo-router';
import { BookOpenCheck, Flame, Lock, Sparkles, Zap, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMeStats } from '@/api/queries/stats';
import type { SubjectStat } from '@/api/types';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ProgressBar } from '@/components/game/ProgressBar';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { XpBarChart } from '@/features/profile/XpBarChart';
import { formatNumber, formatPercent } from '@/lib/format';
import { getLucideIcon } from '@/lib/lucide';
import { colors, fonts, getSubjectAccent, radii, spacing, typography } from '@/theme/tokens';
import { tints } from '@/theme/tints';

/**
 * PUSH /profile/stats — totals for everyone; per-subject accuracy +
 * 14-day XP chart when premium, locked upsell placeholder when free.
 */
export function StatsScreen() {
  const { t } = useTranslation('profile');
  const router = useRouter();
  const stats = useMeStats();

  return (
    <Screen scroll>
      <ScreenHeader title={t('statsScreen.title')} />

      {stats.isPending ? (
        <StatsSkeleton />
      ) : stats.isError ? (
        <ErrorState onRetry={() => void stats.refetch()} retrying={stats.isRefetching} />
      ) : (
        <>
          {/* Totals — visible for everyone */}
          <View style={styles.summaryGrid}>
            <TotalCard
              color={tints.goldText}
              icon={Zap}
              label={t('summary.xpTotal')}
              tintColor={tints.gold}
              value={formatNumber(stats.data.totals.xp_total)}
            />
            <TotalCard
              color={colors.primary[600]}
              icon={BookOpenCheck}
              label={t('summary.levels')}
              tintColor={colors.primary[100]}
              value={formatNumber(stats.data.totals.levels_completed)}
            />
            <TotalCard
              color={tints.successText}
              icon={Sparkles}
              label={t('summary.perfect')}
              tintColor={tints.success}
              value={formatNumber(stats.data.totals.perfect_levels)}
            />
            <TotalCard
              color={tints.flameText}
              icon={Flame}
              label={t('summary.bestStreak')}
              tintColor={tints.flame}
              value={formatNumber(stats.data.totals.best_streak)}
            />
          </View>

          {stats.data.detailed ? (
            <>
              {/* Per-subject accuracy */}
              {stats.data.per_subject && stats.data.per_subject.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>{t('statsScreen.bySubject')}</Text>
                  <View style={styles.subjectList} testID="stats-subjects">
                    {stats.data.per_subject.map((entry) => (
                      <SubjectRow entry={entry} key={entry.subject.slug} />
                    ))}
                  </View>
                </>
              ) : null}

              {/* 14-day XP bars */}
              {stats.data.xp_by_day && stats.data.xp_by_day.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>{t('statsScreen.xpByDay')}</Text>
                  <ClayCard style={styles.chartCard}>
                    <XpBarChart data={stats.data.xp_by_day} />
                  </ClayCard>
                </>
              ) : null}
            </>
          ) : (
            <LockedStats onUpgrade={() => router.push('/paywall')} />
          )}
        </>
      )}
    </Screen>
  );
}

function TotalCard({
  label,
  value,
  icon: Icon,
  color,
  tintColor,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  tintColor: string;
}) {
  return (
    <ClayCard radius="m" style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: tintColor }]}>
        <Icon color={color} size={18} strokeWidth={2.4} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </ClayCard>
  );
}

function SubjectRow({ entry }: { entry: SubjectStat }) {
  const { t } = useTranslation('profile');
  const accent = getSubjectAccent(entry.subject.slug, entry.subject.color_hex);
  const Icon = getLucideIcon(entry.subject.icon);

  return (
    <ClayCard style={styles.subjectRow}>
      <View style={[styles.subjectIcon, { backgroundColor: accent }]}>
        <Icon color={colors.neutral[0]} size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.subjectBody}>
        <View style={styles.subjectTop}>
          <Text numberOfLines={1} style={styles.subjectName}>
            {entry.subject.name}
          </Text>
          <Text style={[styles.subjectPct, { color: accent }]}>
            {formatPercent(entry.accuracy_pct)}
          </Text>
        </View>
        <ProgressBar accent={accent} height={10} progress={entry.accuracy_pct / 100} />
        <Text style={styles.subjectMeta}>
          {t('statsScreen.subjectMeta', {
            answered: formatNumber(entry.answered),
            levels: formatNumber(entry.levels_completed),
            stars: formatNumber(entry.stars_total),
          })}
        </Text>
      </View>
    </ClayCard>
  );
}

/** Free users: greyed fake bars + lock + paywall CTA. */
function LockedStats({ onUpgrade }: { onUpgrade: () => void }) {
  const { t } = useTranslation('profile');
  const fakeHeights = [34, 58, 22, 70, 44, 62, 30];

  return (
    <ClayCard style={styles.lockedCard} testID="stats-locked">
      <View style={styles.lockedBars}>
        {fakeHeights.map((h, i) => (
          <View key={i} style={[styles.lockedBar, { height: h }]} />
        ))}
      </View>
      <View style={styles.lockedOverlay}>
        <View style={styles.lockBubble}>
          <Lock color={colors.primary[600]} size={22} />
        </View>
        <Text style={styles.lockedTitle}>{t('statsScreen.locked.title')}</Text>
        <Text style={styles.lockedBody}>{t('statsScreen.locked.body')}</Text>
        <ClayButton
          onPress={onUpgrade}
          testID="stats-locked-cta"
          title={t('statsScreen.locked.cta')}
          variant="gold"
        />
      </View>
    </ClayCard>
  );
}

function StatsSkeleton() {
  return (
    <View style={styles.skeleton} testID="stats-skeleton">
      <View style={styles.summaryGrid}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton height={76} key={i} radius={radii.m} style={styles.summarySkeleton} />
        ))}
      </View>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton height={92} key={i} radius={radii.l} width="100%" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    marginBottom: spacing.m,
  },
  summaryCard: {
    flexBasis: '45%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.m,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.s,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  summarySkeleton: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  summaryValue: {
    ...typography.h2,
    fontFamily: fonts.headingBlack,
    color: colors.neutral[900],
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.neutral[900],
    marginTop: spacing.m,
    marginBottom: spacing.m,
  },
  subjectList: {
    gap: spacing.m,
  },
  subjectRow: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectBody: {
    flex: 1,
    gap: spacing.xs,
  },
  subjectTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s,
  },
  subjectName: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
    flexShrink: 1,
  },
  subjectPct: {
    ...typography.bodyBold,
  },
  subjectMeta: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  chartCard: {
    marginBottom: spacing.l,
  },
  lockedCard: {
    marginTop: spacing.m,
    overflow: 'hidden',
  },
  lockedBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
    opacity: 0.4,
    paddingHorizontal: spacing.s,
  },
  lockedBar: {
    width: 26,
    borderRadius: radii.s / 2,
    backgroundColor: colors.neutral[300],
  },
  lockedOverlay: {
    alignItems: 'center',
    gap: spacing.s,
    paddingTop: spacing.l,
  },
  lockBubble: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    ...typography.h2,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  lockedBody: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing.s,
  },
  skeleton: {
    gap: spacing.m,
  },
});
