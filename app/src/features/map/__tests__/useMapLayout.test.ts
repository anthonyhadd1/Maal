import type { MapLevel, MapUnit } from '@/api/types';
import {
  AMPLITUDE_RATIO,
  buildMapRows,
  buildRowOffsets,
  computeChapterProgress,
  EDGE_PADDING,
  findCurrentRowIndex,
  nodeCenterX,
  ROW_HEIGHT,
  rowHeight,
  UNIT_HEADER_HEIGHT,
  type NodeRow,
} from '@/features/map/useMapLayout';

function level(id: number, overrides: Partial<MapLevel> = {}): MapLevel {
  return {
    id,
    title: `Niveau ${id}`,
    order: id,
    status: 'locked',
    stars: 0,
    is_free_for_me: true,
    ...overrides,
  };
}

function makeUnits(): MapUnit[] {
  return [
    {
      id: 1,
      title: 'Unité 1',
      order: 1,
      levels: [
        level(11, { status: 'completed', stars: 3 }),
        level(12, { status: 'completed', stars: 1 }),
        level(13, { status: 'unlocked' }),
      ],
    },
    {
      id: 2,
      title: 'Unité 2',
      order: 2,
      levels: [level(21), level(22, { is_boss: true })],
    },
  ];
}

describe('buildMapRows', () => {
  test('flattens units into [header, node…] rows with continuous global indices', () => {
    const rows = buildMapRows(makeUnits());

    expect(rows.map((r) => r.type)).toEqual([
      'unitHeader',
      'node',
      'node',
      'node',
      'unitHeader',
      'node',
      'node',
    ]);
    const nodes = rows.filter((r): r is NodeRow => r.type === 'node');
    expect(nodes.map((n) => n.globalIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(nodes.map((n) => n.level.id)).toEqual([11, 12, 13, 21, 22]);
  });

  test('unit headers carry done/total progress', () => {
    const rows = buildMapRows(makeUnits());
    const headers = rows.filter((r) => r.type === 'unitHeader');
    expect(headers[0]).toMatchObject({ done: 2, total: 3 });
    expect(headers[1]).toMatchObject({ done: 0, total: 2 });
  });

  test('connectors restart at unit boundaries (first node of a unit has no prev)', () => {
    const rows = buildMapRows(makeUnits());
    const nodes = rows.filter((r): r is NodeRow => r.type === 'node');
    expect(nodes[0].prevGlobalIndex).toBeNull();
    expect(nodes[1].prevGlobalIndex).toBe(0);
    expect(nodes[2].prevGlobalIndex).toBe(1);
    // Unit 2 starts a fresh path.
    expect(nodes[3].prevGlobalIndex).toBeNull();
    expect(nodes[4].prevGlobalIndex).toBe(3);
    expect(nodes[4].prevLevel?.id).toBe(21);
  });
});

describe('nodeCenterX', () => {
  const WIDTH = 390;

  test('is deterministic (same index, same width -> same x)', () => {
    for (let i = 0; i < 30; i += 1) {
      expect(nodeCenterX(i, WIDTH)).toBe(nodeCenterX(i, WIDTH));
    }
  });

  test('follows the sine wave: centerX + amplitude * sin(i * 0.9)', () => {
    const usable = WIDTH - EDGE_PADDING * 2;
    const amplitude = usable * AMPLITUDE_RATIO;
    const expected = WIDTH / 2 + amplitude * Math.sin(3 * 0.9);
    expect(nodeCenterX(3, WIDTH)).toBeCloseTo(expected, 6);
  });

  test('stays clamped inside the edge padding', () => {
    for (let i = 0; i < 200; i += 1) {
      const x = nodeCenterX(i, WIDTH);
      expect(x).toBeGreaterThanOrEqual(EDGE_PADDING);
      expect(x).toBeLessThanOrEqual(WIDTH - EDGE_PADDING);
    }
  });
});

describe('getItemLayout math (prefix sums)', () => {
  test('offsets accumulate exact row heights', () => {
    const rows = buildMapRows(makeUnits());
    const offsets = buildRowOffsets(rows);

    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBe(UNIT_HEADER_HEIGHT);
    expect(offsets[2]).toBe(UNIT_HEADER_HEIGHT + ROW_HEIGHT);
    expect(offsets[4]).toBe(UNIT_HEADER_HEIGHT + 3 * ROW_HEIGHT);
    expect(offsets[5]).toBe(2 * UNIT_HEADER_HEIGHT + 3 * ROW_HEIGHT);

    // offset[i] + height[i] === offset[i+1] for every row.
    for (let i = 0; i < rows.length - 1; i += 1) {
      expect(offsets[i] + rowHeight(rows[i])).toBe(offsets[i + 1]);
    }
  });
});

describe('findCurrentRowIndex', () => {
  test('picks the first unlocked-but-not-completed node', () => {
    const rows = buildMapRows(makeUnits());
    const index = findCurrentRowIndex(rows);
    expect(rows[index]).toMatchObject({ type: 'node', level: { id: 13 } });
  });

  test('falls back to the LAST completed node when nothing is unlocked', () => {
    const units: MapUnit[] = [
      {
        id: 1,
        title: 'U1',
        order: 1,
        levels: [
          level(1, { status: 'completed' }),
          level(2, { status: 'completed' }),
          level(3), // locked
        ],
      },
    ];
    const rows = buildMapRows(units);
    const index = findCurrentRowIndex(rows);
    expect(rows[index]).toMatchObject({ type: 'node', level: { id: 2 } });
  });

  test('returns -1 when no node qualifies (all locked / empty map)', () => {
    expect(findCurrentRowIndex(buildMapRows([]))).toBe(-1);
    const allLocked: MapUnit[] = [{ id: 1, title: 'U1', order: 1, levels: [level(1), level(2)] }];
    expect(findCurrentRowIndex(buildMapRows(allLocked))).toBe(-1);
  });
});

describe('computeChapterProgress', () => {
  test('returns null for an empty map', () => {
    expect(computeChapterProgress(buildMapRows([]))).toBeNull();
  });

  test('current chapter = the unit holding the current (first unlocked) node', () => {
    // makeUnits(): unit 1 has the current node (level 13, unlocked); 2 units total.
    const rows = buildMapRows(makeUnits());
    expect(computeChapterProgress(rows)).toEqual({ current: 1, total: 2, subjectCompleted: false });
  });

  test('advances to unit 2 once unit 1 is fully passed and unit 2 has the current node', () => {
    const units: MapUnit[] = [
      {
        id: 1,
        title: 'U1',
        order: 1,
        levels: [level(1, { status: 'completed' }), level(2, { status: 'completed' })],
      },
      {
        id: 2,
        title: 'U2',
        order: 2,
        levels: [level(3, { status: 'unlocked' }), level(4)],
      },
    ];
    const rows = buildMapRows(units);
    expect(computeChapterProgress(rows)).toEqual({ current: 2, total: 2, subjectCompleted: false });
  });

  test('defaults to chapter 1 when nothing is unlocked yet (fresh subject)', () => {
    const units: MapUnit[] = [
      { id: 1, title: 'U1', order: 1, levels: [level(1), level(2)] },
      { id: 2, title: 'U2', order: 2, levels: [level(3), level(4)] },
    ];
    const rows = buildMapRows(units);
    expect(computeChapterProgress(rows)).toEqual({ current: 1, total: 2, subjectCompleted: false });
  });

  test('subjectCompleted is true once every unit has all its levels completed', () => {
    const units: MapUnit[] = [
      {
        id: 1,
        title: 'U1',
        order: 1,
        levels: [level(1, { status: 'completed' }), level(2, { status: 'completed' })],
      },
      {
        id: 2,
        title: 'U2',
        order: 2,
        levels: [level(3, { status: 'completed' })],
      },
    ];
    const rows = buildMapRows(units);
    expect(computeChapterProgress(rows)).toEqual({ current: 2, total: 2, subjectCompleted: true });
  });
});
