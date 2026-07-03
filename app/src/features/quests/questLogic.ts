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
  if (isReviewQuest(code)) return 'brain';
  return 'target';
}

/** The « fais une révision » quest is the one with a single screen to jump to. */
export function isReviewQuest(code: string): boolean {
  const c = code.toLowerCase();
  return c.includes('review') || c.includes('revision');
}

const KNOWN_QUEST_CODES = ['earn_xp', 'complete_levels', 'review_session'];

/**
 * i18n key for a quest's title, or null for a code this build doesn't
 * recognize. The server still sends a French `title` string (its docstring:
 * "Titres FR dans un petit dictionnaire (i18n plus tard)") — that field is
 * meant as a fallback for forward-compat with quest types not in
 * KNOWN_QUEST_CODES yet, not the source of truth for known ones, or the
 * quest card would stay in French regardless of the app's language setting.
 */
export function questTitleKey(code: string): string | null {
  return KNOWN_QUEST_CODES.includes(code) ? `quests.titles.${code}` : null;
}

/** Mascot beside the daily ring: cheering once the goal is reached. */
export function dailyGoalMascotState(fraction: number): MascotState {
  if (fraction >= 1) return 'celebrate';
  if (fraction > 0) return 'idle';
  return 'thinking';
}
