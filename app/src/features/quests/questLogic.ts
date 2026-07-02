import type { MascotState } from '@/components/mascot/mascotStates';

/** Pure quest/daily-goal presentation logic (PLAN reconciled decision 8). */

/** Clamped completion fraction 0..1 (target ≤ 0 counts as done). */
export function questFraction(current: number, target: number): number {
  if (target <= 0) return 1;
  return Math.max(0, Math.min(current / target, 1));
}

/**
 * Quest code → lucide icon name. The 3 static v1 quests are
 * earn-XP / complete-levels / do-a-révision (PLAN decision 8).
 */
export function questIconName(code: string): string {
  const c = code.toLowerCase();
  if (c.includes('xp')) return 'zap';
  if (c.includes('level')) return 'graduation-cap';
  if (c.includes('review') || c.includes('revision')) return 'brain';
  return 'target';
}

/** Mascot beside the daily ring: cheering once the goal is reached. */
export function dailyGoalMascotState(fraction: number): MascotState {
  if (fraction >= 1) return 'celebrate';
  if (fraction > 0) return 'idle';
  return 'thinking';
}
