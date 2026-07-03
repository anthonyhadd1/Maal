import { splitSubjectStats } from '@/features/profile/statsLogic';
import type { SubjectStat } from '@/api/types';

function stat(overrides: Partial<SubjectStat>): SubjectStat {
  return {
    subject: 'biologie',
    name: 'Biologie',
    accuracy_pct: 0,
    answered: 0,
    levels_completed: 0,
    stars_total: 0,
    ...overrides,
  };
}

describe('splitSubjectStats', () => {
  it('returns empty arrays when there is no data', () => {
    expect(splitSubjectStats(undefined)).toEqual({ started: [], notStarted: [] });
    expect(splitSubjectStats([])).toEqual({ started: [], notStarted: [] });
  });

  it('buckets untouched subjects (answered === 0) into notStarted', () => {
    const untouched = stat({ subject: 'chimie', name: 'Chimie', answered: 0 });
    const touched = stat({ subject: 'biologie', name: 'Biologie', answered: 5, accuracy_pct: 80 });

    const { started, notStarted } = splitSubjectStats([untouched, touched]);

    expect(started).toEqual([touched]);
    expect(notStarted).toEqual([untouched]);
  });

  it('sorts started subjects by accuracy desc, then answered desc', () => {
    const low = stat({ subject: 'a', name: 'A', answered: 10, accuracy_pct: 40 });
    const high = stat({ subject: 'b', name: 'B', answered: 3, accuracy_pct: 90 });
    const tieHigherVolume = stat({ subject: 'c', name: 'C', answered: 20, accuracy_pct: 40 });

    const { started } = splitSubjectStats([low, high, tieHigherVolume]);

    expect(started.map((s) => s.subject)).toEqual(['b', 'c', 'a']);
  });

  it('handles a large real-world mix (12 specialties + 4 concours subjects)', () => {
    const entries: SubjectStat[] = [
      stat({ subject: 'biologie', name: 'Biologie', answered: 70, accuracy_pct: 39 }),
      ...Array.from({ length: 15 }, (_, i) =>
        stat({ subject: `specialite-${i}`, name: `Spécialité ${i}`, answered: 0 }),
      ),
    ];

    const { started, notStarted } = splitSubjectStats(entries);

    expect(started).toHaveLength(1);
    expect(notStarted).toHaveLength(15);
  });
});
