import { useRouter } from 'expo-router';
import {
  BarChart3,
  ChevronRight,
  Crown,
  Settings,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAchievements } from '@/api/queries/achievements';
import { useMe } from '@/api/queries/auth';
import { useFriendRequests } from '@/api/queries/friends';
import { useMeGame } from '@/api/queries/game';
import { useMeStats } from '@/api/queries/stats';
import { ClayCard } from '@/components/clay/ClayCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Avatar } from '@/components/game/Avatar';
import { StreakFlame } from '@/components/game/StreakFlame';
import { XPBadge } from '@/components/game/XPBadge';
import { PressableScale } from '@/components/layout/PressableScale';
import { Screen } from '@/components/layout/Screen';
import { formatDate, formatNumber } from '@/lib/format';
import { colors, fonts, radii, spacing, typography } from '@/theme/tokens';
import { tints } from '@/theme/tints';

/** TAB 4 « Profil » — hero + summary + premium status + drill-down rows. */
export function ProfileScreen() {
  const { t } = useTranslation('profile');
  const router = useRouter();
  const me = useMe();
  const game = useMeGame();
  const stats = useMeStats();
  const achievements = useAchievements();
  const requests = useFriendRequests();

  const unlocked = achievements.data?.filter((a) => a.unlocked_at != null).length;
  const pendingCount = requests.data?.incoming.length ?? 0;
  const isPremium = me.data?.entitlement?.is_premium ?? false;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('title')}
        </Text>
      </View>

      {me.isPending ? (
        <ProfileSkeleton />
      ) : me.isError ? (
        <ErrorState onRetry={() => void me.refetch()} retrying={me.isRefetching} />
      ) : (
        <>
          {/* Hero */}
          <ClayCard style={styles.card}>
            <View style={styles.identityRow}>
              <View style={styles.avatarRing}>
                <Avatar
                  avatarId={me.data.profile.avatar_id}
                  name={me.data.profile.display_name || me.data.username}
                  size={72}
                />
              </View>
              <View style={styles.identity}>
                <Text numberOfLines={1} style={styles.displayName}>
                  {me.data.profile.display_name || me.data.username}
                </Text>
                <Text numberOfLines={1} style={styles.username}>
                  {t('usernamePrefix', { username: me.data.username })}
                </Text>
                <Text style={styles.memberSince}>
                  {t('memberSince', { date: formatDate(me.data.date_joined) })}
                </Text>
              </View>
            </View>
            <View style={styles.chipsRow}>
              <XPBadge xp={game.data?.xp_total ?? 0} />
              <View style={styles.chip}>
                <StreakFlame days={game.data?.streak_current ?? 0} size={18} />
              </View>
              {game.data?.league ? (
                <View style={styles.chip} testID="league-chip">
                  <Trophy color={colors.xpGold} size={16} />
                  <Text style={styles.chipLabel}>
                    {typeof game.data.league.tier === 'string'
                      ? game.data.league.tier
                      : game.data.league.tier.name}
                  </Text>
                </View>
              ) : null}
            </View>
          </ClayCard>

          {/* Totals summary */}
          {stats.data ? (
            <View style={styles.summaryGrid} testID="profile-summary">
              <SummaryCard
                label={t('summary.xpTotal')}
                value={formatNumber(stats.data.totals.xp_total)}
              />
              <SummaryCard
                label={t('summary.levels')}
                value={formatNumber(stats.data.totals.levels_completed)}
              />
              <SummaryCard
                label={t('summary.perfect')}
                value={formatNumber(stats.data.totals.perfect_levels)}
              />
              <SummaryCard
                label={t('summary.bestStreak')}
                value={formatNumber(stats.data.totals.best_streak)}
              />
            </View>
          ) : stats.isPending ? (
            <View style={styles.summaryGrid}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton height={76} key={i} radius={radii.m} style={styles.summarySkeleton} />
              ))}
            </View>
          ) : null}

          {/* Premium status */}
          {isPremium ? (
            <ClayCard style={[styles.card, styles.premiumCard]} testID="premium-card">
              <View style={styles.crownBubble}>
                <Crown color={tints.goldText} size={22} strokeWidth={2.2} />
              </View>
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>{t('premium.active')}</Text>
                {me.data.entitlement?.premium_until ? (
                  <Text style={styles.premiumUntil}>
                    {t('premium.activeUntil', {
                      date: formatDate(me.data.entitlement.premium_until),
                    })}
                  </Text>
                ) : null}
              </View>
            </ClayCard>
          ) : (
            <PressableScale
              accessibilityLabel={t('premium.upsell')}
              onPress={() => router.push('/paywall')}
              style={[styles.row, styles.upsellRow]}
              testID="premium-upsell"
            >
              <View style={styles.crownBubble}>
                <Crown color={tints.goldText} size={22} strokeWidth={2.2} />
              </View>
              <Text style={styles.upsellText}>{t('premium.upsell')}</Text>
              <ChevronRight color={colors.primary[600]} size={20} />
            </PressableScale>
          )}

          {/* Drill-down rows */}
          <View style={styles.rows}>
            <NavRow
              icon={BarChart3}
              label={t('rows.stats')}
              onPress={() => router.push('/profile/stats')}
              testID="row-stats"
            />
            <NavRow
              icon={Trophy}
              label={t('rows.achievements')}
              meta={
                unlocked != null && achievements.data
                  ? `${unlocked}/${achievements.data.length}`
                  : undefined
              }
              onPress={() => router.push('/profile/achievements')}
              testID="row-achievements"
            />
            <NavRow
              badge={pendingCount > 0 ? pendingCount : undefined}
              icon={Users}
              label={t('rows.friends')}
              onPress={() => router.push('/friends')}
              testID="row-friends"
            />
            <NavRow
              icon={Settings}
              label={t('rows.settings')}
              onPress={() => router.push('/profile/settings')}
              testID="row-settings"
            />
          </View>
        </>
      )}
    </Screen>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <ClayCard radius="m" style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </ClayCard>
  );
}

function NavRow({
  icon: Icon,
  label,
  meta,
  badge,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  meta?: string;
  badge?: number;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} style={styles.row} testID={testID}>
      <View style={styles.rowIcon}>
        <Icon color={colors.primary[600]} size={20} strokeWidth={2.2} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      {badge != null ? (
        <View style={styles.badge} testID={`${testID}-badge`}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight color={colors.neutral[500]} size={20} />
    </PressableScale>
  );
}

function ProfileSkeleton() {
  return (
    <View style={styles.skeletonGroup}>
      <View style={styles.skeletonRow}>
        <Skeleton height={72} radius={radii.pill} width={72} />
        <View style={styles.skeletonLines}>
          <Skeleton height={20} width="70%" />
          <Skeleton height={14} width="45%" />
          <Skeleton height={14} width="55%" />
        </View>
      </View>
      <Skeleton height={76} radius={radii.l} />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton height={60} key={i} radius={radii.l} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.l,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  card: {
    marginBottom: spacing.l,
    gap: spacing.l,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  avatarRing: {
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.primary[400],
    padding: 3,
    backgroundColor: colors.neutral[0],
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    ...typography.h2,
    fontSize: 22,
    lineHeight: 28,
    color: colors.neutral[900],
  },
  username: {
    ...typography.small,
    color: colors.neutral[500],
  },
  memberSince: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.s,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  chipLabel: {
    ...typography.smallMedium,
    color: colors.neutral[900],
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    marginBottom: spacing.l,
  },
  summaryCard: {
    flexBasis: '45%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.m,
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
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderBottomColor: 'rgba(180, 83, 9, 0.5)',
  },
  crownBubble: {
    width: 44,
    height: 44,
    borderRadius: radii.s,
    backgroundColor: tints.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumText: {
    flex: 1,
    gap: 2,
  },
  premiumTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
  },
  premiumUntil: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  upsellRow: {
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderBottomWidth: 3,
    borderBottomColor: colors.primary[300],
    backgroundColor: colors.primary[50],
    marginBottom: spacing.l,
    paddingVertical: spacing.m,
  },
  upsellText: {
    ...typography.bodyMedium,
    fontFamily: fonts.bodyBold,
    color: colors.primary[700],
    flex: 1,
  },
  rows: {
    gap: spacing.m,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.l,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(36, 31, 62, 0.05)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(36, 31, 62, 0.09)',
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
    flex: 1,
  },
  rowMeta: {
    ...typography.smallMedium,
    color: colors.neutral[500],
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.neutral[0],
  },
  skeletonGroup: {
    gap: spacing.l,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  skeletonLines: {
    flex: 1,
    gap: spacing.s,
  },
});
