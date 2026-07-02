import { useRouter } from 'expo-router';
import { ChevronRight, Snowflake, Trophy } from 'lucide-react-native';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAchievements } from '@/api/queries/achievements';
import { useMeGame } from '@/api/queries/game';
import { keys } from '@/api/queries/keys';
import { useQuestsToday } from '@/api/queries/quests';
import { queryClient } from '@/api/queryClient';
import { ClayCard } from '@/components/clay/ClayCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StreakFlame } from '@/components/game/StreakFlame';
import { PressableScale } from '@/components/layout/PressableScale';
import { Screen } from '@/components/layout/Screen';
import { DailyGoalRing } from '@/features/quests/DailyGoalRing';
import { QuestCard } from '@/features/quests/QuestCard';
import { formatNumber } from '@/lib/format';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const MAX_FREEZES = 2;

/**
 * TAB 3 « Quêtes » (PLAN reconciled decision 8): daily goal ring + the 3
 * static daily quests + streak section + achievements entry.
 */
export function QuestsScreen() {
  const { t } = useTranslation('quests');
  const router = useRouter();
  const quests = useQuestsToday();
  const game = useMeGame();
  const achievements = useAchievements();

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.quests }),
      queryClient.invalidateQueries({ queryKey: keys.game }),
      queryClient.invalidateQueries({ queryKey: keys.achievements }),
    ]);
  }, []);

  const unlockedCount = achievements.data?.filter((a) => a.unlocked_at != null).length ?? null;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl onRefresh={refresh} refreshing={quests.isRefetching} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {t('title')}
        </Text>

        {quests.isPending ? (
          <QuestsSkeleton />
        ) : quests.isError ? (
          <ErrorState onRetry={() => void quests.refetch()} retrying={quests.isRefetching} />
        ) : (
          <>
            {/* Daily goal ring */}
            <ClayCard style={styles.goalCard}>
              <Text style={styles.sectionTitle}>{t('dailyGoal.title')}</Text>
              <DailyGoalRing
                current={quests.data.daily_goal.current}
                target={quests.data.daily_goal.target}
              />
            </ClayCard>

            {/* The 3 static daily quests */}
            <Text style={styles.sectionTitle}>{t('quests.title')}</Text>
            <View style={styles.questList}>
              {quests.data.quests.map((quest) => (
                <QuestCard key={quest.code} quest={quest} />
              ))}
            </View>
          </>
        )}

        {/* Streak section */}
        <Text style={styles.sectionTitle}>{t('streak.title')}</Text>
        <ClayCard style={styles.streakCard}>
          <View style={styles.streakRow}>
            <View style={styles.streakStat}>
              <StreakFlame days={game.data?.streak_current ?? 0} size={26} />
              <Text style={styles.streakLabel}>{t('streak.current')}</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakStat}>
              <Text style={styles.streakBest}>
                {formatNumber(game.data?.streak_longest ?? 0)}
              </Text>
              <Text style={styles.streakLabel}>{t('streak.longest')}</Text>
            </View>
          </View>

          {typeof game.data?.streak_freezes === 'number' ? (
            <View style={styles.freezeRow} testID="freeze-chips">
              <Text style={styles.freezeLabel}>{t('streak.freezes')}</Text>
              <View style={styles.freezeChips}>
                {Array.from({ length: MAX_FREEZES }, (_, i) => {
                  const held = i < (game.data?.streak_freezes ?? 0);
                  return (
                    <View
                      key={i}
                      style={[styles.freezeChip, held && styles.freezeChipHeld]}
                      testID={held ? 'freeze-held' : 'freeze-empty'}
                    >
                      <Snowflake
                        color={held ? colors.freezeBlue : colors.neutral[300]}
                        size={16}
                        strokeWidth={2.4}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ClayCard>

        {/* Achievements entry */}
        <PressableScale
          accessibilityLabel={t('achievements.row')}
          onPress={() => router.push('/profile/achievements')}
          style={styles.achievementsRow}
          testID="quests-achievements-row"
        >
          <View style={styles.trophyBubble}>
            <Trophy color={colors.xpGold} fill={colors.xpGold} size={22} />
          </View>
          <Text style={styles.achievementsLabel}>{t('achievements.row')}</Text>
          {unlockedCount != null && achievements.data ? (
            <Text style={styles.achievementsCount}>
              {t('achievements.count', {
                unlocked: unlockedCount,
                total: achievements.data.length,
              })}
            </Text>
          ) : null}
          <ChevronRight color={colors.neutral[500]} size={20} />
        </PressableScale>
      </ScrollView>
    </Screen>
  );
}

function QuestsSkeleton() {
  return (
    <View style={styles.skeleton} testID="quests-skeleton">
      <Skeleton height={180} radius={radii.l} width="100%" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton height={88} key={i} radius={radii.l} width="100%" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: spacing.xxl,
    gap: spacing.m,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    marginBottom: spacing.s,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.neutral[900],
    marginTop: spacing.s,
  },
  goalCard: {
    gap: spacing.m,
  },
  questList: {
    gap: spacing.m,
  },
  streakCard: {
    gap: spacing.l,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakStat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.neutral[100],
  },
  streakBest: {
    ...typography.h1,
    color: colors.streakOrange,
  },
  streakLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  freezeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  freezeLabel: {
    ...typography.smallMedium,
    color: colors.neutral[700],
  },
  freezeChips: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  freezeChip: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  freezeChipHeld: {
    backgroundColor: colors.primary[50],
  },
  achievementsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.l,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.l,
  },
  trophyBubble: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementsLabel: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
    flex: 1,
  },
  achievementsCount: {
    ...typography.smallMedium,
    color: colors.neutral[500],
  },
  skeleton: {
    gap: spacing.m,
  },
});
