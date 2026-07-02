import type { LeaderboardRow } from '@/api/types';

/**
 * Pure leaderboard presentation logic (design_gameplay.md §4):
 * top `promote_count` move up, bottom `demote_count` move down. The list
 * interleaves zone separators between the rows.
 */

export type BoardZone = 'promote' | 'demote';

export type BoardItem =
  | { type: 'row'; key: string; row: LeaderboardRow }
  | { type: 'separator'; key: string; zone: BoardZone };

/**
 * Interleave rows with zone separators:
 * - promotion separator AFTER the first `promoteCount` rows,
 * - danger separator BEFORE the last `demoteCount` rows.
 * Separators are skipped when the cohort is too small for the zones to make
 * sense (fewer rows than the zone, or overlapping promote/demote zones).
 */
export function buildBoardItems(
  rows: LeaderboardRow[],
  promoteCount: number,
  demoteCount: number,
): BoardItem[] {
  const showPromote = promoteCount > 0 && rows.length > promoteCount;
  const demoteStart = rows.length - demoteCount;
  const showDemote = demoteCount > 0 && rows.length > demoteCount && demoteStart > promoteCount;

  const items: BoardItem[] = [];
  rows.forEach((row, index) => {
    if (showPromote && index === promoteCount) {
      items.push({ type: 'separator', key: 'sep-promote', zone: 'promote' });
    }
    if (showDemote && index === demoteStart) {
      items.push({ type: 'separator', key: 'sep-demote', zone: 'demote' });
    }
    items.push({ type: 'row', key: `row-${row.rank}-${row.username}`, row });
  });
  return items;
}

/** Which zone a rank falls into (rank is 1-based). */
export function rowZone(
  rank: number,
  rowCount: number,
  promoteCount: number,
  demoteCount: number,
): BoardZone | null {
  if (promoteCount > 0 && rank <= promoteCount) return 'promote';
  if (demoteCount > 0 && rowCount > demoteCount && rank > rowCount - demoteCount) return 'demote';
  return null;
}
