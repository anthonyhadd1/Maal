import { buildBoardItems, rowZone } from '@/features/leagues/leaderboardZones';
import { boardRows } from '@/test/fixtures/social';

describe('buildBoardItems (promotion/danger separators)', () => {
  test('30-row cohort, promote 10 / demote 5: separators after row 10 and before last 5', () => {
    const items = buildBoardItems(boardRows(30), 10, 5);

    // 30 rows + 2 separators
    expect(items).toHaveLength(32);
    // First 10 rows, then the promotion separator…
    expect(items[9]).toMatchObject({ type: 'row', row: { rank: 10 } });
    expect(items[10]).toMatchObject({ type: 'separator', zone: 'promote' });
    expect(items[11]).toMatchObject({ type: 'row', row: { rank: 11 } });
    // …danger separator right before rank 26 (30 − 5).
    expect(items[26]).toMatchObject({ type: 'separator', zone: 'demote' });
    expect(items[27]).toMatchObject({ type: 'row', row: { rank: 26 } });
    expect(items[31]).toMatchObject({ type: 'row', row: { rank: 30 } });
  });

  test('row order is preserved around separators', () => {
    const items = buildBoardItems(boardRows(30), 10, 5);
    const ranks = items.filter((i) => i.type === 'row').map((i) => i.row.rank);
    expect(ranks).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  test('cohort smaller than the promotion zone: no separators at all', () => {
    const items = buildBoardItems(boardRows(8), 10, 5);
    expect(items).toHaveLength(8);
    expect(items.every((i) => i.type === 'row')).toBe(true);
  });

  test('overlapping zones (12 rows, promote 10, demote 5): demote separator skipped', () => {
    const items = buildBoardItems(boardRows(12), 10, 5);
    const separators = items.filter((i) => i.type === 'separator');
    expect(separators).toHaveLength(1);
    expect(separators[0]).toMatchObject({ zone: 'promote' });
  });

  test('friends board (no zones): promote/demote 0 → rows only', () => {
    const items = buildBoardItems(boardRows(6), 0, 0);
    expect(items).toHaveLength(6);
    expect(items.every((i) => i.type === 'row')).toBe(true);
  });

  test('is_me row survives the interleave (highlight source of truth)', () => {
    const items = buildBoardItems(boardRows(30, 12), 10, 5);
    const me = items.find((i) => i.type === 'row' && i.row.is_me);
    expect(me).toMatchObject({ type: 'row', row: { rank: 12, is_me: true } });
  });
});

describe('rowZone', () => {
  test('top promote_count ranks are in the promotion zone', () => {
    expect(rowZone(1, 30, 10, 5)).toBe('promote');
    expect(rowZone(10, 30, 10, 5)).toBe('promote');
    expect(rowZone(11, 30, 10, 5)).toBeNull();
  });

  test('bottom demote_count ranks are in the danger zone', () => {
    expect(rowZone(26, 30, 10, 5)).toBe('demote');
    expect(rowZone(30, 30, 10, 5)).toBe('demote');
    expect(rowZone(25, 30, 10, 5)).toBeNull();
  });

  test('zones disabled at 0 counts', () => {
    expect(rowZone(1, 30, 0, 0)).toBeNull();
    expect(rowZone(30, 30, 0, 0)).toBeNull();
  });
});
