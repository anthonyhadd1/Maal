import {
  onboardingPrevious,
  onboardingProgress,
} from '@/features/onboarding/onboardingProgress';

/**
 * The app covers ONE track (the USJ concours), so onboarding is a fixed
 * three-step flow: goal → rhythm → notifications. The opening
 * "Que prépares-tu ?" step was removed with the spécialité track — a choice
 * between one option is not a choice.
 */
describe('onboardingProgress', () => {
  test('three steps, in order', () => {
    expect(onboardingProgress('goal')).toEqual({ step: 0, totalSteps: 3 });
    expect(onboardingProgress('rhythm')).toEqual({ step: 1, totalSteps: 3 });
    expect(onboardingProgress('notifications')).toEqual({ step: 2, totalSteps: 3 });
  });

  test('every step index is inside the dot count — no phantom dot', () => {
    for (const screen of ['goal', 'rhythm', 'notifications'] as const) {
      const { step, totalSteps } = onboardingProgress(screen);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThan(totalSteps);
    }
  });

  test('each step has a distinct position', () => {
    const steps = (['goal', 'rhythm', 'notifications'] as const).map(
      (s) => onboardingProgress(s).step,
    );
    expect(new Set(steps).size).toBe(steps.length);
  });
});

/**
 * Back affordance. Onboarding commits each answer with a PATCH and navigates
 * with `router.replace`, so there is no history to pop — the arrow needs an
 * explicit target, derived from the same ordered flow as the dots.
 */
describe('onboardingPrevious', () => {
  test('the first step has no back target', () => {
    expect(onboardingPrevious('goal')).toBeNull();
  });

  test('later steps walk back one at a time', () => {
    expect(onboardingPrevious('rhythm')).toBe('goal');
    expect(onboardingPrevious('notifications')).toBe('rhythm');
  });

  test('back always lands exactly one dot to the left', () => {
    for (const screen of ['goal', 'rhythm', 'notifications'] as const) {
      const here = onboardingProgress(screen);
      const back = onboardingPrevious(screen);
      if (back === null) {
        expect(here.step).toBe(0);
      } else {
        expect(onboardingProgress(back).step).toBe(here.step - 1);
      }
    }
  });
});
