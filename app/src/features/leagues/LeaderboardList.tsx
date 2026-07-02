import { ChevronsDown, ChevronsUp } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View, type RefreshControlProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LeaderboardRow } from '@/api/types';
import { Avatar } from '@/components/game/Avatar';
import { buildBoardItems, type BoardItem } from '@/features/leagues/leaderboardZones';
import { formatNumber } from '@/lib/format';
import { colors, fonts, medalColors, radii, shadows, spacing, typography } from '@/theme/tokens';
import { darken } from '@/features/leagues/tierColor';

interface LeaderboardListProps {
  rows: LeaderboardRow[];
  promoteCount?: number;
  demoteCount?: number;
  header?: ReactElement;
  refreshControl?: ReactElement<RefreshControlProps>;
}

/**
 * Leaderboard rows: clay list with rank medals (1–3 = gold/silver/bronze
 * discs), avatar, name, tabular right-aligned XP — my row gets the accent
 * border + tint; promotion/danger zone separators between the right rows.
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
  const promote = zone === 'promote';
  const color = promote ? colors.successDeep : colors.dangerDeep;
  const bg = promote ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.10)';
  const Icon = promote ? ChevronsUp : ChevronsDown;
  const label = promote ? t('promotionZone') : t('dangerZone');

  return (
    <View style={styles.separator} testID={`zone-${zone}`}>
      <View style={[styles.separatorLine, { backgroundColor: color }]} />
      <View style={[styles.separatorPill, { backgroundColor: bg }]}>
        <Icon color={color} size={14} strokeWidth={2.8} />
        <Text style={[styles.separatorLabel, { color }]}>{label}</Text>
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
        <View
          style={[
            styles.medal,
            { backgroundColor: medal, borderBottomColor: darken(medal, 0.28) },
          ]}
        >
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
      <Text style={[styles.xp, row.is_me && styles.xpMe]}>
        {t('xpWeek', { xp: formatNumber(row.xp_week) })}
      </Text>
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
    borderColor: 'rgba(36, 31, 62, 0.04)',
    borderBottomColor: 'rgba(36, 31, 62, 0.08)',
    ...shadows.clayPressed,
  },
  rowMe: {
    borderColor: colors.primary[500],
    borderBottomColor: colors.primary[600],
    backgroundColor: colors.primary[50],
    ...shadows.clayRaised,
  },
  medal: {
    width: 30,
    height: 32,
    borderRadius: radii.pill,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    fontFamily: fonts.headingBlack,
    fontSize: 13,
    lineHeight: 16,
    color: colors.neutral[0],
  },
  rank: {
    ...typography.smallMedium,
    fontFamily: fonts.bodyBold,
    color: colors.neutral[500],
    width: 30,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
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
    color: colors.primary[700],
  },
  youTag: {
    ...typography.caption,
    fontFamily: fonts.bodyBold,
    color: colors.primary[600],
  },
  xp: {
    ...typography.smallMedium,
    color: colors.neutral[700],
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  xpMe: {
    fontFamily: fonts.bodyBold,
    color: colors.primary[700],
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.xs,
  },
  separatorLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    opacity: 0.25,
  },
  separatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 3,
  },
  separatorLabel: {
    ...typography.caption,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
