import { firstSubjectSlug } from '@/api/queries/subjectsHelpers';
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
