import {
  dailyGoalMascotState,
  questFraction,
  questIconName,
  questTitleKey,
} from '@/features/quests/questLogic';

describe('questFraction', () => {
  test('maps current/target to 0..1', () => {
    expect(questFraction(0, 40)).toBe(0);
    expect(questFraction(26, 40)).toBeCloseTo(0.65);
    expect(questFraction(40, 40)).toBe(1);
  });

  test('clamps overshoot and negative values', () => {
    expect(questFraction(80, 40)).toBe(1);
    expect(questFraction(-5, 40)).toBe(0);
  });

  test('target 0 counts as done (no division by zero)', () => {
    expect(questFraction(0, 0)).toBe(1);
  });
});

describe('questIconName (the 3 static v1 quests — PLAN decision 8)', () => {
  test('maps quest codes to lucide names', () => {
    expect(questIconName('daily_xp')).toBe('zap');
    expect(questIconName('daily_levels')).toBe('graduation-cap');
    expect(questIconName('daily_review')).toBe('brain');
    expect(questIconName('DAILY_REVISION')).toBe('brain');
  });

  test('unknown codes fall back to target', () => {
    expect(questIconName('mystery_quest')).toBe('target');
  });
});

describe('questTitleKey (localizes the 3 known quests, not the server FR fallback)', () => {
  test('known codes map to an i18n key', () => {
    expect(questTitleKey('earn_xp')).toBe('quests.titles.earn_xp');
    expect(questTitleKey('complete_levels')).toBe('quests.titles.complete_levels');
    expect(questTitleKey('review_session')).toBe('quests.titles.review_session');
  });

  test('unrecognized codes return null (caller falls back to quest.title)', () => {
    expect(questTitleKey('mystery_quest')).toBeNull();
  });
});

describe('dailyGoalMascotState', () => {
  test('thinking before any XP, idle mid-way, celebrate when done', () => {
    expect(dailyGoalMascotState(0)).toBe('thinking');
    expect(dailyGoalMascotState(0.5)).toBe('idle');
    expect(dailyGoalMascotState(1)).toBe('celebrate');
  });
});
