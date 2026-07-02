import type { MapUnit } from '@/api/types';
import { sceneryFor, seeded } from '@/features/map/MapScenery';
import { CULTURE_SET, propSetFor } from '@/features/map/sceneryProps';
import { buildMapRows, nodeCenterX, type NodeRow } from '@/features/map/useMapLayout';

const WIDTH = 390;

describe('seeded', () => {
  test('is deterministic and stays in [0, 1]', () => {
    for (let i = 0; i < 200; i += 1) {
      const v = seeded(i, 7);
      expect(v).toBe(seeded(i, 7));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test('different salts decorrelate the same index', () => {
    expect(seeded(5, 1)).not.toBe(seeded(5, 2));
  });
});

describe('sceneryFor', () => {
  test('same inputs -> identical placements (no render randomness)', () => {
    for (let i = 0; i < 40; i += 1) {
      const x = nodeCenterX(i, WIDTH);
      expect(sceneryFor(i, 4, x, WIDTH)).toEqual(sceneryFor(i, 4, x, WIDTH));
    }
  });

  test('props always land on the EMPTY side, clear of the node sphere', () => {
    for (let i = 0; i < 80; i += 1) {
      const x = nodeCenterX(i, WIDTH);
      for (const p of sceneryFor(i, 4, x, WIDTH)) {
        if (x >= WIDTH / 2) {
          expect(p.left + p.size).toBeLessThanOrEqual(x - 45);
        } else {
          expect(p.left).toBeGreaterThanOrEqual(x + 45);
        }
        expect(p.propIndex).toBeGreaterThanOrEqual(0);
        expect(p.propIndex).toBeLessThan(4);
      }
    }
  });

  test('some rows breathe (no props) and no row exceeds 2 props', () => {
    let empty = 0;
    for (let i = 0; i < 60; i += 1) {
      const placements = sceneryFor(i, 4, nodeCenterX(i, WIDTH), WIDTH);
      if (placements.length === 0) empty += 1;
      expect(placements.length).toBeLessThanOrEqual(2);
    }
    expect(empty).toBeGreaterThan(0);
  });
});

describe('propSetFor', () => {
  test('maps subject slugs and falls back to the culture set', () => {
    expect(propSetFor('biologie')).toHaveLength(4);
    expect(propSetFor('chimie')).toHaveLength(3);
    expect(propSetFor('physique')).toHaveLength(4);
    expect(propSetFor('maths')).toBe(CULTURE_SET);
    expect(propSetFor('')).toBe(CULTURE_SET);
  });
});

describe('buildMapRows milestone metadata', () => {
  const units: MapUnit[] = [
    {
      id: 1,
      title: 'U1',
      order: 1,
      levels: [
        { id: 11, title: 'A', order: 1, status: 'completed', stars: 3, is_free_for_me: true },
        { id: 12, title: 'B', order: 2, status: 'completed', stars: 2, is_free_for_me: true },
      ],
    },
    {
      id: 2,
      title: 'U2',
      order: 2,
      levels: [
        { id: 21, title: 'C', order: 1, status: 'unlocked', stars: 0, is_free_for_me: true },
        { id: 22, title: 'D', order: 2, status: 'locked', stars: 0, is_free_for_me: true, is_boss: true },
      ],
    },
  ];

  test('flags the LAST node of each unit and carries unit progress', () => {
    const nodes = buildMapRows(units).filter((r): r is NodeRow => r.type === 'node');
    expect(nodes.map((n) => n.isUnitLast)).toEqual([false, true, false, true]);
    expect(nodes[1]).toMatchObject({ unitDone: 2, unitTotal: 2, unitIndex: 0 });
    expect(nodes[3]).toMatchObject({ unitDone: 0, unitTotal: 2, unitIndex: 1 });
  });
});
