import { Crown, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAchievements } from '@/api/queries/achievements';
import type { AchievementItem } from '@/api/types';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ProgressBar } from '@/components/game/ProgressBar';
import { PressableScale } from '@/components/layout/PressableScale';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { questFraction } from '@/features/quests/questLogic';
import { formatDate, formatNumber } from '@/lib/format';
import { getLucideIcon } from '@/lib/lucide';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/**
 * PUSH /profile/achievements — the 21-trophy grid (design_gameplay.md §5):
 * unlocked = gold clay, locked = grey outline + lock, premium-only = crown
 * corner. Tap → ClayDialog detail (description, date or progress).
 */
export function AchievementsScreen() {
  const { t } = useTranslation('profile');
  const achievements = useAchievements();
  const [selected, setSelected] = useState<AchievementItem | null>(null);

  const data = achievements.data
    ? [...achievements.data].sort((a, b) => a.order - b.order)
    : undefined;
  const unlockedCount = data?.filter((a) => a.unlocked_at != null).length ?? 0;

  return (
    <Screen padded={false}>
      <View style={styles.headerWrap}>
        <ScreenHeader title={t('achievementsScreen.title')} />
        {data ? (
          <Text style={styles.count} testID="achievements-count">
            {t('achievementsScreen.unlockedCount', {
              unlocked: unlockedCount,
              total: data.length,
            })}
          </Text>
        ) : null}
      </View>

      {achievements.isPending ? (
        <View style={styles.skeletonGrid} testID="achievements-skeleton">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton height={148} key={i} radius={radii.l} style={styles.skeletonCell} />
          ))}
        </View>
      ) : achievements.isError ? (
        <ErrorState
          onRetry={() => void achievements.refetch()}
          retrying={achievements.isRefetching}
        />
      ) : data && data.length === 0 ? (
        <EmptyState mascotState="thinking" title={t('achievementsScreen.empty')} />
      ) : (
        <FlatList
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.listContent}
          data={data}
          keyExtractor={(item) => item.code}
          numColumns={2}
          renderItem={({ item }) => (
            <TrophyCard achievement={item} onPress={() => setSelected(item)} />
          )}
          showsVerticalScrollIndicator={false}
          testID="achievements-grid"
        />
      )}

      <AchievementDialog achievement={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function TrophyCard({
  achievement,
  onPress,
}: {
  achievement: AchievementItem;
  onPress: () => void;
}) {
  const { t } = useTranslation('profile');
  const unlocked = achievement.unlocked_at != null;
  const Icon = getLucideIcon(achievement.icon);

  return (
    <PressableScale
      accessibilityLabel={achievement.title}
      onPress={onPress}
      style={styles.cell}
      testID={`trophy-${achievement.code}`}
    >
      <View style={[styles.cellCard, unlocked ? styles.cellUnlocked : styles.cellLocked]}>
        {achievement.is_premium_only ? (
          <View style={styles.crownCorner} testID={`trophy-${achievement.code}-crown`}>
            <Crown color={colors.xpGold} fill={colors.xpGold} size={14} />
          </View>
        ) : null}
        <View style={[styles.iconBubble, unlocked ? styles.iconUnlocked : styles.iconLocked]}>
          {unlocked ? (
            <Icon color={colors.neutral[0]} size={26} strokeWidth={2.2} />
          ) : (
            <Lock color={colors.neutral[500]} size={22} />
          )}
        </View>
        <Text numberOfLines={2} style={[styles.cellTitle, !unlocked && styles.cellTitleLocked]}>
          {achievement.title}
        </Text>
        {unlocked ? (
          <Text style={styles.cellDate}>
            {formatDate(achievement.unlocked_at!)}
          </Text>
        ) : (
          <Text style={styles.cellDate}>{t('achievementsScreen.locked')}</Text>
        )}
      </View>
    </PressableScale>
  );
}

function AchievementDialog({
  achievement,
  onClose,
}: {
  achievement: AchievementItem | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation('common');

  if (!achievement) return null;

  const unlocked = achievement.unlocked_at != null;
  const showProgress = !unlocked && achievement.progress != null;

  return (
    <ClayDialog
      actions={[{ label: tCommon('cta.close'), onPress: onClose, variant: 'primary' }]}
      message={achievement.description}
      onRequestClose={onClose}
      title={achievement.title}
      visible
    >
      {unlocked ? (
        <Text style={styles.dialogDate}>
          {t('achievementsScreen.unlockedAt', { date: formatDate(achievement.unlocked_at!) })}
        </Text>
      ) : showProgress ? (
        <View style={styles.dialogProgress} testID="achievement-progress">
          <ProgressBar
            accent={colors.xpGold}
            height={10}
            progress={questFraction(achievement.progress!, achievement.threshold)}
          />
          <Text style={styles.dialogProgressLabel}>
            {t('achievementsScreen.progress', {
              progress: formatNumber(achievement.progress!),
              threshold: formatNumber(achievement.threshold),
            })}
          </Text>
        </View>
      ) : (
        <Text style={styles.dialogDate}>{t('achievementsScreen.locked')}</Text>
      )}
      {achievement.is_premium_only ? (
        <View style={styles.dialogPremiumRow}>
          <Crown color={colors.xpGold} fill={colors.xpGold} size={16} />
          <Text style={styles.dialogPremium}>{t('achievementsScreen.premiumOnly')}</Text>
        </View>
      ) : null}
    </ClayDialog>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
  },
  count: {
    ...typography.smallMedium,
    color: colors.neutral[500],
    marginTop: -spacing.s,
    marginBottom: spacing.m,
  },
  listContent: {
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xxl,
  },
  column: {
    gap: spacing.m,
  },
  cell: {
    flex: 1,
    marginBottom: spacing.m,
  },
  cellCard: {
    alignItems: 'center',
    gap: spacing.s,
    borderRadius: radii.l,
    paddingVertical: spacing.l,
    paddingHorizontal: spacing.m,
    minHeight: 148,
  },
  cellUnlocked: {
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.xpGold,
  },
  cellLocked: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
  },
  crownCorner: {
    position: 'absolute',
    top: spacing.s,
    right: spacing.s,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnlocked: {
    backgroundColor: colors.xpGold,
  },
  iconLocked: {
    backgroundColor: colors.neutral[100],
  },
  cellTitle: {
    ...typography.smallMedium,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  cellTitleLocked: {
    color: colors.neutral[500],
  },
  cellDate: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    paddingHorizontal: spacing.l,
  },
  skeletonCell: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  dialogDate: {
    ...typography.smallMedium,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  dialogProgress: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  dialogProgressLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  dialogPremiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dialogPremium: {
    ...typography.caption,
    color: colors.neutral[700],
  },
});
