import type { SubjectStat } from '@/api/types';

/**
 * Split /me/stats/ per_subject rows into "started" (answered ≥ 1, shown as
 * full accuracy cards, best-first) and "not started" (shown as a single
 * compact list). The backend returns one row per active Subject regardless
 * of whether the user has ever played it, so a track with 12+ specialty
 * subjects would otherwise render a dozen near-identical "0 %" cards.
 */
export function splitSubjectStats(entries: SubjectStat[] | undefined): {
  started: SubjectStat[];
  notStarted: SubjectStat[];
} {
  if (!entries || entries.length === 0) return { started: [], notStarted: [] };

  const started = entries
    .filter((entry) => entry.answered > 0)
    .sort((a, b) => b.accuracy_pct - a.accuracy_pct || b.answered - a.answered);
  const notStarted = entries.filter((entry) => entry.answered === 0);

  return { started, notStarted };
}
