/**
 * Progress-dot geometry for the onboarding flow.
 *
 * The app covers ONE track — the USJ concours d'entrée. The spécialité track
 * was removed on 2026-07-28, and with it the opening "Que prépares-tu ?" step:
 * asking someone to choose between one option is not a question. The flow is
 * now goal → rhythm → notifications.
 *
 * The track argument is retained on the signature so callers (and the router)
 * don't all have to change at once, but it no longer branches: every learner
 * walks the same three steps.
 */
export type OnboardingScreen = 'goal' | 'rhythm' | 'notifications';

const FLOW: OnboardingScreen[] = ['goal', 'rhythm', 'notifications'];

export function onboardingProgress(screen: OnboardingScreen): {
  step: number;
  totalSteps: number;
} {
  const found = FLOW.indexOf(screen);
  // A screen outside the flow shouldn't occur; fall back to the first dot
  // rather than reporting -1.
  return { step: found < 0 ? 0 : found, totalSteps: FLOW.length };
}

/**
 * The screen before `screen`, or null on the first step.
 *
 * Onboarding navigates with `router.replace`, so there is no history to pop —
 * a back affordance needs an explicit target. Deriving it from the same
 * ordered list as the dots keeps the arrow and the dot count in agreement.
 */
export function onboardingPrevious(screen: OnboardingScreen): OnboardingScreen | null {
  const found = FLOW.indexOf(screen);
  return found > 0 ? FLOW[found - 1] : null;
}
