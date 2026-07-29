import type { MapUnit } from '@/api/types';

/**
 * Chapter view-model derivation — deliberately kept free of React/router
 * imports so the syllabus logic stays unit-testable on its own.
 */
export type ChapterState = 'completed' | 'current' | 'available' | 'locked';

export interface ChapterVM {
  id: number;
  /** 0-based position, rendered as "Chapitre index+1". */
  index: number;
  title: string;
  done: number;
  total: number;
  state: ChapterState;
}

/**
 * Units -> chapter view models. The FIRST chapter holding an unlocked level is
 * "current" (and only ever one is, so the screen has a single emphasised
 * card); fully-done chapters are "completed"; all-locked ones are "locked".
 */
export function buildChapters(units: MapUnit[]): ChapterVM[] {
  let currentTaken = false;
  return units.map((unit, index) => {
    const total = unit.levels.length;
    const done = unit.levels.filter((l) => l.status === 'completed').length;
    const hasUnlocked = unit.levels.some((l) => l.status === 'unlocked');
    const allLocked = total > 0 && unit.levels.every((l) => l.status === 'locked');

    let state: ChapterState;
    if (total > 0 && done >= total) {
      state = 'completed';
    } else if (hasUnlocked && !currentTaken) {
      state = 'current';
      currentTaken = true;
    } else if (allLocked) {
      state = 'locked';
    } else {
      state = 'available';
    }
    return { id: unit.id, index, title: unit.title, done, total, state };
  });
}
