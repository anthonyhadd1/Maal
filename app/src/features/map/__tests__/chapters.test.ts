import type { MapLevel, MapUnit } from '@/api/types';
import { buildChapters } from '@/features/map/chapters';
import { buildMapRows, chapterInView } from '@/features/map/useMapLayout';
import { useMapNavStore } from '@/stores/mapNavStore';

function level(id: number, status: MapLevel['status']): MapLevel {
  return { id, title: `Niveau ${id}`, order: id, status, stars: 0, is_free_for_me: true };
}

function unit(id: number, statuses: MapLevel['status'][]): MapUnit {
  return {
    id,
    title: `Chapitre ${id}`,
    order: id,
    levels: statuses.map((s, i) => level(id * 100 + i, s)),
  };
}

describe('buildChapters', () => {
  test('marks a fully-completed chapter as completed', () => {
    const [c] = buildChapters([unit(1, ['completed', 'completed'])]);
    expect(c.state).toBe('completed');
    expect(c.done).toBe(2);
    expect(c.total).toBe(2);
  });

  test('the FIRST chapter holding an unlocked level is the current one', () => {
    const chapters = buildChapters([
      unit(1, ['completed', 'completed']),
      unit(2, ['completed', 'unlocked', 'locked']),
      unit(3, ['unlocked', 'locked']),
    ]);
    expect(chapters.map((c) => c.state)).toEqual(['completed', 'current', 'available']);
  });

  test('exactly one chapter is ever "current" — the emphasis must be unambiguous', () => {
    const chapters = buildChapters([
      unit(1, ['unlocked']),
      unit(2, ['unlocked']),
      unit(3, ['unlocked']),
    ]);
    expect(chapters.filter((c) => c.state === 'current')).toHaveLength(1);
    expect(chapters[0].state).toBe('current');
  });

  test('an all-locked chapter reads as locked', () => {
    const chapters = buildChapters([unit(1, ['unlocked']), unit(2, ['locked', 'locked'])]);
    expect(chapters[1].state).toBe('locked');
  });

  test('counts only completed levels as done', () => {
    const [c] = buildChapters([unit(1, ['completed', 'unlocked', 'locked', 'completed'])]);
    expect(c.done).toBe(2);
    expect(c.total).toBe(4);
  });

  test('keeps syllabus order and 0-based index for numbering', () => {
    const chapters = buildChapters([unit(7, ['locked']), unit(9, ['locked'])]);
    expect(chapters.map((c) => c.id)).toEqual([7, 9]);
    expect(chapters.map((c) => c.index)).toEqual([0, 1]);
  });

  test('handles an empty subject without crashing', () => {
    expect(buildChapters([])).toEqual([]);
  });

  test('a chapter with no levels is not falsely "completed"', () => {
    const [c] = buildChapters([unit(1, [])]);
    expect(c.state).not.toBe('completed');
  });
});

describe('mapNavStore jump intent', () => {
  beforeEach(() => {
    useMapNavStore.setState({ pendingUnitId: null });
  });

  test('consuming clears the intent so the map scrolls exactly once', () => {
    useMapNavStore.getState().requestJumpToUnit(42);
    expect(useMapNavStore.getState().pendingUnitId).toBe(42);

    expect(useMapNavStore.getState().consumePendingUnit()).toBe(42);
    expect(useMapNavStore.getState().pendingUnitId).toBeNull();
    expect(useMapNavStore.getState().consumePendingUnit()).toBeNull();
  });
});

/**
 * "Which chapter is this level in?"
 *
 * The map renders bottom-to-top, which pushes each chapter banner BELOW the
 * levels it introduces — scanning downward it reads like a footer for the
 * wrong chapter, and once you scroll a screen away from a banner nothing on
 * screen answers the question at all. `chapterInView` feeds the pinned bar
 * that does.
 */
describe('chapterInView', () => {
  const units = [
    unit(1, ['completed', 'completed']),
    unit(2, ['completed', 'unlocked']),
    unit(3, ['locked']),
  ];
  const rows = buildMapRows(units);

  test('reports the chapter the visible rows belong to', () => {
    // rows: [H1, L1a, L1b, H2, L2a, L2b, H3, L3a]
    const seen = chapterInView(rows, [4, 5]);
    expect(seen?.index).toBe(1);
    expect(seen?.title).toBe('Chapitre 2');
  });

  test('carries that chapter’s own completion, not the subject’s', () => {
    const seen = chapterInView(rows, [4, 5]);
    expect(seen?.done).toBe(1);
    expect(seen?.levels).toBe(2);

    const first = chapterInView(rows, [1, 2]);
    expect(first?.done).toBe(2);
    expect(first?.levels).toBe(2);
  });

  test('a chapter banner row identifies its own chapter', () => {
    expect(chapterInView(rows, [3])?.index).toBe(1);
  });

  test('straddling a boundary reports the LOWER chapter, so it does not flicker', () => {
    // Climbing upward, a lower unitIndex sits further down the screen; the bar
    // should stay on the chapter being climbed out of until it truly leaves.
    expect(chapterInView(rows, [2, 3, 4])?.index).toBe(0);
  });

  test('returns null when nothing is visible', () => {
    expect(chapterInView(rows, [])).toBeNull();
    expect(chapterInView([], [0, 1])).toBeNull();
  });

  test('ignores out-of-range indices rather than crashing', () => {
    expect(chapterInView(rows, [999, 4])?.index).toBe(1);
    expect(chapterInView(rows, [999])).toBeNull();
  });

  test('every row in the subject resolves to a chapter — no orphan levels', () => {
    for (let i = 0; i < rows.length; i += 1) {
      const seen = chapterInView(rows, [i]);
      expect(seen).not.toBeNull();
      expect(seen!.index).toBe(rows[i].unitIndex);
    }
  });
});
