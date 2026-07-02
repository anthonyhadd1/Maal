import { ChevronsDown, ChevronsUp } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View, type RefreshControlProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LeaderboardRow } from '@/api/types';
import { Avatar } from '@/components/game/Avatar';
import { buildBoardItems, type BoardItem } from '@/features/leagues/leaderboardZones';
import { formatNumber } from '@/lib/format';
import { colors, medalColors, radii, spacing, typography } from '@/theme/tokens';

interface LeaderboardListProps {
  rows: LeaderboardRow[];
  promoteCount?: number;
  demoteCount?: number;
  header?: ReactElement;
  refreshControl?: ReactElement<RefreshControlProps>;
}

/**
 * Leaderboard rows: rank medal (1–3), avatar, name, weekly XP — my row
 * highlighted; promotion/danger zone separators between the right rows.
 */
export function LeaderboardList({
  rows,
  promoteCount = 0,
  demoteCount = 0,
  header,
  refreshControl,
}: LeaderboardListProps) {
  const items = buildBoardItems(rows, promoteCount, demoteCount);

  return (
    <FlatList
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(item) => item.key}
      refreshControl={refreshControl}
      renderItem={({ item }) => <BoardItemView item={item} />}
      showsVerticalScrollIndicator={false}
      testID="leaderboard-list"
    />
  );
}

function BoardItemView({ item }: { item: BoardItem }) {
  if (item.type === 'separator') {
    return <ZoneSeparator zone={item.zone} />;
  }
  return <LeaderboardRowView row={item.row} />;
}

function ZoneSeparator({ zone }: { zone: 'promote' | 'demote' }) {
  const { t } = useTranslation('leagues');
  const color = zone === 'promote' ? colors.success : colors.danger;
  const Icon = zone === 'promote' ? ChevronsUp : ChevronsDown;
  const label = zone === 'promote' ? t('promotionZone') : t('dangerZone');

  return (
    <View style={styles.separator} testID={`zone-${zone}`}>
      <View style={[styles.separatorLine, { backgroundColor: color }]} />
      <View style={styles.separatorLabelRow}>
        <Icon color={color} size={16} strokeWidth={2.6} />
        <Text style={[styles.separatorLabel, { color }]}>{label}</Text>
        <Icon color={color} size={16} strokeWidth={2.6} />
      </View>
      <View style={[styles.separatorLine, { backgroundColor: color }]} />
    </View>
  );
}

const MEDALS: Record<number, string> = {
  1: medalColors.gold,
  2: medalColors.silver,
  3: medalColors.bronze,
};

function LeaderboardRowView({ row }: { row: LeaderboardRow }) {
  const { t } = useTranslation('leagues');
  const medal = MEDALS[row.rank];
  const name = row.display_name || row.username;

  return (
    <View
      accessibilityLabel={`${row.rank}. ${name} — ${t('xpWeek', { xp: formatNumber(row.xp_week) })}`}
      style={[styles.row, row.is_me && styles.rowMe]}
      testID={row.is_me ? 'board-row-me' : `board-row-${row.rank}`}
    >
      {medal ? (
        <View style={[styles.medal, { backgroundColor: medal }]}>
          <Text style={styles.medalText}>{row.rank}</Text>
        </View>
      ) : (
        <Text style={styles.rank}>{row.rank}</Text>
      )}
      <Avatar avatarId={row.avatar_id} name={name} size={40} />
      <View style={styles.names}>
        <Text numberOfLines={1} style={[styles.name, row.is_me && styles.nameMe]}>
          {name}
        </Text>
        {row.is_me ? <Text style={styles.youTag}>{t('you')}</Text> : null}
      </View>
      <Text style={styles.xp}>{t('xpWeek', { xp: formatNumber(row.xp_week) })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowMe: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  medal: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    ...typography.caption,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[0],
  },
  rank: {
    ...typography.smallMedium,
    color: colors.neutral[500],
    width: 28,
    textAlign: 'center',
  },
  names: {
    flex: 1,
    gap: 1,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  nameMe: {
    fontFamily: typography.bodyBold.fontFamily,
  },
  youTag: {
    ...typography.caption,
    color: colors.primary[600],
  },
  xp: {
    ...typography.smallMedium,
    color: colors.neutral[700],
  },
  separator: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  separatorLine: {
    height: 2,
    borderRadius: 1,
    opacity: 0.35,
  },
  separatorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  separatorLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
