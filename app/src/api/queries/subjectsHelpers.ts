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
