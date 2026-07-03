import { isTieredSubjects, type SubjectsResponse } from '@/api/types';

/**
 * First subject in a SubjectsResponse regardless of tree shape — used to
 * pick a sensible default `activeSubjectSlug` right after switching tracks.
 * Flat: first item by (already server-ordered) array order.
 * Tiered: first year -> first semester -> first subject.
 */
export function firstSubjectSlug(data: SubjectsResponse | undefined): string | null {
  if (!data) return null;
  if (isTieredSubjects(data)) {
    return data.years[0]?.semesters[0]?.subjects[0]?.slug ?? null;
  }
  return data[0]?.slug ?? null;
}

/**
 * Does this SubjectsResponse actually contain `slug`? Used to validate a
 * persisted `activeSubjectSlug` before trusting it — settingsStore is a
 * single global (per-device) key, so a slug picked under a different
 * account or a different track (e.g. a specialty subject left over from a
 * previous session) can otherwise leak into a track that doesn't have it,
 * silently showing the wrong subject's map.
 */
export function containsSubjectSlug(data: SubjectsResponse | undefined, slug: string | null): boolean {
  if (!data || !slug) return false;
  if (isTieredSubjects(data)) {
    return data.years.some((year) =>
      year.semesters.some((semester) => semester.subjects.some((s) => s.slug === slug)),
    );
  }
  return data.some((s) => s.slug === slug);
}
