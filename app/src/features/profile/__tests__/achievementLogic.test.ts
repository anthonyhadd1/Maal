import {
  achievementTextKeys,
  expertSubjectName,
  isExpertAchievement,
} from '@/features/profile/achievementLogic';

describe('achievementTextKeys (localizes the 20 static trophies)', () => {
  test('known static codes map to catalog i18n keys', () => {
    expect(achievementTextKeys('premiere-victoire')).toEqual({
      titleKey: 'achievementsScreen.catalog.premiere-victoire.title',
      descriptionKey: 'achievementsScreen.catalog.premiere-victoire.description',
    });
    expect(achievementTextKeys('collectionneur-d-or')).toEqual({
      titleKey: 'achievementsScreen.catalog.collectionneur-d-or.title',
      descriptionKey: 'achievementsScreen.catalog.collectionneur-d-or.description',
    });
  });

  test('the expert-family and unrecognized codes return null', () => {
    expect(achievementTextKeys('expert-biologie')).toBeNull();
    expect(achievementTextKeys('mystery-trophy')).toBeNull();
  });
});

describe('isExpertAchievement', () => {
  test('detects the expert-{slug} code pattern', () => {
    expect(isExpertAchievement('expert-biologie')).toBe(true);
    expect(isExpertAchievement('expert-urologie')).toBe(true);
    expect(isExpertAchievement('centurion')).toBe(false);
  });
});

describe('expertSubjectName (parses the subject out of the raw FR title)', () => {
  test('strips the fixed "Expert·e " prefix', () => {
    expect(expertSubjectName('Expert·e Biologie')).toBe('Biologie');
    expect(expertSubjectName('Expert·e Chirurgie Viscérale')).toBe('Chirurgie Viscérale');
  });
});
