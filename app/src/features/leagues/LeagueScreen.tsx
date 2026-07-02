import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/api/queries/auth';
import { keys } from '@/api/queries/keys';
import { useFriendsLeaderboard, useLeague } from '@/api/queries/leagues';
import { queryClient } from '@/api/queryClient';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PressableScale } from '@/components/layout/PressableScale';
import { Screen } from '@/components/layout/Screen';
import { LeagueBadge } from '@/features/leagues/LeagueBadge';
import { LeaderboardList } from '@/features/leagues/LeaderboardList';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Board = 'league' | 'friends';

/** TAB 2 « Ligue » — weekly league + friends leaderboard (design_mobile.md §3/§5). */
export function LeagueScreen() {
  const { t } = useTranslation('leagues');
  const router = useRouter();
  const me = useMe();

  const [board, setBoard] = useState<Board>('league');

  // Poll every 30 s ONLY while this tab is focused (design_mobile.md §5).
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const optedIn = me.data?.profile.leagues_opt_in ?? true;
  const league = useLeague({ focused: focused && board === 'league', enabled: optedIn });
  const friendsBoard = useFriendsLeaderboard({
    focused: focused && board === 'friends',
    enabled: board === 'friends',
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: board === 'league' ? keys.league : keys.leaderboardFriends,
    });
  }, [board]);

  // Opt-out state: explain + route to settings (design_gameplay.md §4).
  if (me.data && !optedIn) {
    return (
      <Screen>
        <Header />
        <EmptyState
          cta={{ label: t('optOut.cta'), onPress: () => router.push('/profile/settings') }}
          mascotState="thinking"
          message={t('optOut.message')}
          title={t('optOut.title')}
        />
      </Screen>
    );
  }

  const toggle = (
    <View style={styles.toggleRow} testID="board-toggle">
      <TogglePill
        active={board === 'league'}
        label={t('toggle.league')}
        onPress={() => setBoard('league')}
        testID="toggle-league"
      />
      <TogglePill
        active={board === 'friends'}
        label={t('toggle.friends')}
        onPress={() => setBoard('friends')}
        testID="toggle-friends"
      />
    </View>
  );

  if (board === 'friends') {
    return (
      <Screen>
        <Header />
        {toggle}
        {friendsBoard.isPending ? (
          <BoardSkeleton />
        ) : friendsBoard.isError ? (
          <ErrorState
            onRetry={() => void friendsBoard.refetch()}
            retrying={friendsBoard.isRefetching}
          />
        ) : friendsBoard.data.length <= 1 ? (
          <EmptyState
            cta={{ label: t('friendsEmpty.cta'), onPress: () => router.push('/friends/search') }}
            mascotState="idle"
            message={t('friendsEmpty.message')}
            title={t('friendsEmpty.title')}
          />
        ) : (
          <LeaderboardList
            refreshControl={
              <RefreshControl onRefresh={refresh} refreshing={friendsBoard.isRefetching} />
            }
            rows={friendsBoard.data}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header />
      {toggle}
      {league.isPending ? (
        <BoardSkeleton withBadge />
      ) : league.isError ? (
        <ErrorState onRetry={() => void league.refetch()} retrying={league.isRefetching} />
      ) : league.data.rows.length === 0 || league.data.rank == null || !league.data.tier ? (
        <EmptyState
          cta={{ label: t('empty.cta'), onPress: () => router.navigate('/') }}
          mascotState="idle"
          message={t('empty.message')}
          title={t('empty.title')}
        />
      ) : (
        <LeaderboardList
          demoteCount={league.data.demote_count}
          header={
            <LeagueBadge
              demoteCount={league.data.demote_count}
              promoteCount={league.data.promote_count}
              tier={league.data.tier}
              weekEndsAt={league.data.week_ends_at}
            />
          }
          promoteCount={league.data.promote_count}
          refreshControl={<RefreshControl onRefresh={refresh} refreshing={league.isRefetching} />}
          rows={league.data.rows}
        />
      )}
    </Screen>
  );
}

function Header() {
  const { t } = useTranslation('leagues');
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('title')}
      </Text>
    </View>
  );
}

function TogglePill({
  active,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      clay={false}
      onPress={onPress}
      pressedTranslateY={2}
      style={[styles.pill, active && styles.pillActive]}
      testID={testID}
    >
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{label}</Text>
    </PressableScale>
  );
}

function BoardSkeleton({ withBadge = false }: { withBadge?: boolean }) {
  return (
    <View style={styles.skeleton} testID="board-skeleton">
      {withBadge ? (
        <View style={styles.skeletonBadge}>
          <Skeleton height={88} radius={radii.pill} width={88} />
          <Skeleton height={24} width="45%" />
        </View>
      ) : null}
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton height={64} key={i} radius={radii.m} width="100%" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.m,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: radii.pill,
    padding: spacing.xs,
    marginBottom: spacing.l,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingVertical: spacing.s,
  },
  pillActive: {
    backgroundColor: colors.neutral[0],
  },
  pillLabel: {
    ...typography.smallMedium,
    color: colors.neutral[500],
  },
  pillLabelActive: {
    color: colors.primary[600],
    fontFamily: typography.h2.fontFamily,
  },
  skeleton: {
    gap: spacing.s,
  },
  skeletonBadge: {
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.m,
  },
});
