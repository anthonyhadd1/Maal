import { containsSubjectSlug, firstSubjectSlug } from '@/api/queries/subjectsHelpers';
import { isTieredSubjects, type SubjectFlat, type TieredSubjectsResponse } from '@/api/types';

/**
 * SubjectsResponse discriminated union (contract §"API contract"): flat
 * tracks (concours) return an array, tiered tracks (specialite) return a
 * single {track, years} object. `isTieredSubjects` must narrow correctly in
 * both directions, and `firstSubjectSlug` must resolve a sensible default
 * regardless of tree shape.
 */

function flatSubject(overrides: Partial<SubjectFlat> = {}): SubjectFlat {
  return {
    id: 1,
    name: 'Urologie',
    slug: 'urologie',
    color_hex: '#0EA5E9',
    icon: 'stethoscope',
    order: 1,
    track: 'specialite',
    ...overrides,
  };
}

function tieredResponse(): TieredSubjectsResponse {
  return {
    track: 'specialite',
    years: [
      {
        id: 1,
        name: 'M1 - 4e année',
        order: 1,
        semesters: [
          {
            id: 1,
            name: 'S1',
            order: 1,
            subjects: [
              flatSubject({ id: 1, slug: 'urologie', order: 1 }),
              flatSubject({ id: 2, slug: 'gynecologie', order: 2 }),
            ],
          },
          {
            id: 2,
            name: 'S2',
            order: 2,
            subjects: [flatSubject({ id: 7, slug: 'nephrologie', order: 1 })],
          },
        ],
      },
    ],
  };
}

describe('isTieredSubjects', () => {
  test('flat array (concours today) is NOT tiered', () => {
    expect(isTieredSubjects([flatSubject({ track: 'concours' })])).toBe(false);
  });

  test('empty flat array is NOT tiered', () => {
    expect(isTieredSubjects([])).toBe(false);
  });

  test('{track, years} object IS tiered', () => {
    expect(isTieredSubjects(tieredResponse())).toBe(true);
  });
});

describe('firstSubjectSlug', () => {
  test('undefined data -> null', () => {
    expect(firstSubjectSlug(undefined)).toBeNull();
  });

  test('flat: first item in array order', () => {
    const data = [flatSubject({ slug: 'biologie', order: 1 }), flatSubject({ slug: 'chimie', order: 2 })];
    expect(firstSubjectSlug(data)).toBe('biologie');
  });

  test('flat: empty array -> null', () => {
    expect(firstSubjectSlug([])).toBeNull();
  });

  test('tiered: first year -> first semester -> first subject', () => {
    expect(firstSubjectSlug(tieredResponse())).toBe('urologie');
  });

  test('tiered: empty years -> null', () => {
    expect(firstSubjectSlug({ track: 'specialite', years: [] })).toBeNull();
  });

  test('tiered: year with no semesters -> null', () => {
    expect(
      firstSubjectSlug({
        track: 'specialite',
        years: [{ id: 1, name: 'M1', order: 1, semesters: [] }],
      }),
    ).toBeNull();
  });
});

/**
 * Regression: settingsStore.activeSubjectSlug is a single global (per-device)
 * persisted key — a slug picked under a DIFFERENT account, or under a
 * DIFFERENT track, can otherwise leak into a track that doesn't have it (e.g.
 * a leftover "specialite-gynecologie" slug silently rendering under
 * "Concours d'entrée" for a brand-new user who never touched that track).
 * containsSubjectSlug is what LevelsMap uses to detect and correct this.
 */
describe('containsSubjectSlug', () => {
  test('undefined data -> false', () => {
    expect(containsSubjectSlug(undefined, 'urologie')).toBe(false);
  });

  test('null slug -> false', () => {
    expect(containsSubjectSlug([flatSubject({ slug: 'biologie' })], null)).toBe(false);
  });

  test('flat: slug present -> true', () => {
    const data = [flatSubject({ slug: 'biologie' }), flatSubject({ slug: 'chimie' })];
    expect(containsSubjectSlug(data, 'chimie')).toBe(true);
  });

  test('flat: slug absent (stale/foreign slug) -> false', () => {
    const data = [flatSubject({ slug: 'biologie' }), flatSubject({ slug: 'chimie' })];
    expect(containsSubjectSlug(data, 'specialite-gynecologie')).toBe(false);
  });

  test('tiered: slug present in a non-first semester -> true', () => {
    expect(containsSubjectSlug(tieredResponse(), 'nephrologie')).toBe(true);
  });

  test('tiered: slug absent (e.g. a concours slug leaking into specialite) -> false', () => {
    expect(containsSubjectSlug(tieredResponse(), 'biologie')).toBe(false);
  });
});
