/**
 * DTOs mirrored from the DRF serializers (backend/apps/accounts) and the
 * endpoint contracts in docs/design_backend.md §4 + docs/PLAN.md reconciled
 * decision 1 (per-question grading).
 */

// ---------------------------------------------------------------------------
// Auth / accounts
// ---------------------------------------------------------------------------

export interface Tokens {
  access: string;
  refresh: string;
}

export interface Profile {
  display_name: string;
  avatar_id: string;
  target_faculty: number | null;
  exam_year: number | null;
  daily_goal_xp: number;
  locale: string;
  onboarding_completed: boolean;
  leagues_opt_in: boolean;
}

export interface Me {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  profile: Profile;
}

export interface RegisterPayload {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
}

export interface RegisterResponse {
  user: Me;
  tokens: Tokens;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface Faculty {
  id: number;
  name: string;
  slug: string;
  order: number;
}

// ---------------------------------------------------------------------------
// Content / map
// ---------------------------------------------------------------------------

export interface Subject {
  id: number;
  name: string;
  slug: string;
  color_hex: string;
  icon: string;
  order: number;
  /** Per-user completion percentage (0–100). */
  completion_pct?: number;
}

export type LevelStatus = 'locked' | 'unlocked' | 'completed';

export interface MapLevel {
  id: number;
  title: string;
  order: number;
  status: LevelStatus;
  stars: number;
  is_free_for_me: boolean;
  is_boss?: boolean;
  is_legendary?: boolean;
}

export interface MapUnit {
  id: number;
  title: string;
  order: number;
  levels: MapLevel[];
}

export interface SubjectMap {
  subject: Subject;
  units: MapUnit[];
}

// ---------------------------------------------------------------------------
// Attempt flow (server-authoritative, per-question grading)
// ---------------------------------------------------------------------------

export type QuestionType = 'single' | 'multi' | 'true_false';

export interface AttemptChoice {
  id: number;
  text: string;
  image_url: string | null;
}

export interface AttemptPassage {
  title?: string | null;
  text: string;
  image_url?: string | null;
}

/** Served at attempt start — NEVER contains is_correct or explanations. */
export interface AttemptQuestion {
  id: number;
  qtype: QuestionType;
  text: string;
  image_url: string | null;
  passage: AttemptPassage | null;
  choices: AttemptChoice[];
}

export interface StartAttemptResponse {
  attempt_id: number;
  questions: AttemptQuestion[];
}

export interface AnswerPayload {
  question_id: number;
  selected_choice_ids: number[];
  time_ms: number;
}

/** Grading response for ONE question (wrong answers deduct a heart here). */
export interface AnswerResponse {
  is_correct: boolean;
  correct_choice_ids: number[];
  explanation_text: string;
  explanation_media_url: string | null;
  hearts_remaining: number;
  next_heart_at: string | null;
  combo: number;
}

export interface XpBreakdown {
  base: number;
  perfect_bonus: number;
  combo_bonus?: number;
  first_clear_bonus: number;
  streak_bonus?: number;
  total: number;
}

export interface HeartsState {
  lost: number;
  remaining: number;
  next_heart_at: string | null;
}

export interface StreakState {
  current: number;
  extended_today: boolean;
}

export interface AchievementUnlocked {
  code: string;
  title: string;
}

export interface ReviewEntry {
  question_id: number;
  is_correct: boolean;
  correct_choice_ids: number[];
  explanation_text: string;
  explanation_media_url: string | null;
  explanation_media_type?: 'image' | 'video' | 'lottie' | null;
}

export interface CompleteResponse {
  score_pct: number;
  correct_count: number;
  total_count: number;
  stars: number;
  passed: boolean;
  xp: XpBreakdown;
  hearts: HeartsState;
  streak: StreakState;
  unlocked_level_id: number | null;
  achievements_unlocked: AchievementUnlocked[];
  review: ReviewEntry[];
}

// ---------------------------------------------------------------------------
// Gamification summary
// ---------------------------------------------------------------------------

export interface MeGame {
  xp_total: number;
  hearts: number;
  next_heart_at: string | null;
  streak_current: number;
  streak_longest: number;
  league: {
    tier: string;
    rank: number;
    xp_week: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** DRF error body: {detail: "..."} or {field: ["msg", ...]}. */
export type ApiErrorBody = { detail?: string } & Record<string, string[] | string | undefined>;
