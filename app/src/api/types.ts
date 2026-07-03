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
  /** Slug of the active Track (read); write accepts a track slug. null = unset. */
  active_track: string | null;
}

export interface Me {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  profile: Profile;
  /** Premium entitlement summary — included on /me/ (backend doc §4). */
  entitlement?: Entitlement;
}

export interface Entitlement {
  is_premium: boolean;
  /** null = no expiry (admin grant) or free user. */
  premium_until: string | null;
  source: string;
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

/**
 * GET /tracks/ row — top-level exam category (« Concours d'entrée »,
 * « Examens de Spécialité »…). Ordered by `order`, no pagination.
 */
export interface Track {
  slug: string;
  name: string;
  description: string;
  /** Lucide icon name (kebab-case). */
  icon: string;
  color_hex: string;
  order: number;
}

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

/**
 * GET /subjects/?track=<slug> — flat shape (today's concours behavior),
 * with an additive `track` slug field on every item.
 */
export interface SubjectFlat extends Subject {
  track: string;
}

export interface ProgramSemesterGroup {
  id: number;
  name: string;
  order: number;
  /**
   * Bare Subject shape here (per contract) — NOT SubjectFlat. The additive
   * `track` field only appears on items of the top-level flat array shape;
   * nested tiered subjects omit it (the track is already the response root).
   */
  subjects: Subject[];
}

export interface ProgramYearGroup {
  id: number;
  name: string;
  order: number;
  semesters: ProgramSemesterGroup[];
}

/** GET /subjects/?track=<slug> — tiered shape (tracks with ProgramYear rows). */
export interface TieredSubjectsResponse {
  track: string;
  years: ProgramYearGroup[];
}

/**
 * Discriminated union for GET /subjects/?track=<slug>: a flat track
 * (concours today) returns an array; a tiered track (specialite) returns a
 * single object keyed by `years`. Use `isTieredSubjects` to narrow — do NOT
 * rely on `Array.isArray` alone for documentation purposes (it IS the right
 * check here, but the guard centralizes it so call sites stay consistent).
 */
export type SubjectsResponse = SubjectFlat[] | TieredSubjectsResponse;

/** Type guard: narrows a SubjectsResponse to the tiered (years) shape. */
export function isTieredSubjects(x: SubjectsResponse): x is TieredSubjectsResponse {
  return !Array.isArray(x) && typeof x === 'object' && x !== null && 'years' in x;
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
  /** Provenance chip: « Concours 2019 · juillet ». Absent for owner-written drills. */
  exam_year?: number | null;
  exam_session?: string | null;
}

export interface StartAttemptResponse {
  attempt_id: number;
  questions: AttemptQuestion[];
}

/** GET /practice/mistakes/ — counter + truncated preview, never answers. */
export interface PracticeMistakesPreview {
  count: number;
  questions: { id: number; subject: string; text: string }[];
}

/** POST /levels/{id}/attempts/ body — {"legendary": true} starts legendary mode. */
export interface StartAttemptPayload {
  legendary?: boolean;
}

/** One already-graded answer inside the attempt resume payload. */
export interface AttemptAnsweredEntry {
  question_id: number;
  selected_choice_ids: number[];
  is_correct: boolean;
}

/** GET /attempts/{id}/ — resume payload: questions + answered verdicts. */
export interface AttemptDetailResponse {
  attempt_id: number;
  level_id: number;
  questions: AttemptQuestion[];
  answered: AttemptAnsweredEntry[];
}

export interface AnswerPayload {
  question_id: number;
  selected_choice_ids: number[];
  time_ms: number;
}

export type ExplanationMediaType = 'image' | 'video' | 'lottie';

/** Grading response for ONE question (wrong answers deduct a heart here). */
export interface AnswerResponse {
  is_correct: boolean;
  correct_choice_ids: number[];
  /** null on legendary runs — explanations are withheld until the end. */
  explanation_text: string | null;
  explanation_media_url: string | null;
  explanation_media_type: ExplanationMediaType | null;
  hearts_remaining: number;
  /** Premium / grace period: hearts are never deducted. */
  hearts_unlimited: boolean;
  next_heart_at: string | null;
  combo: number;
}

export interface XpBreakdown {
  base: number;
  perfect_bonus: number;
  combo_bonus?: number;
  first_clear_bonus: number;
  streak_bonus?: number;
  /** One-time +40 XP for earning the legendary crown (PLAN decision 9). */
  legendary_bonus?: number;
  total: number;
}

export interface HeartsState {
  lost: number;
  remaining: number;
  /** True during signup grace / premium — `remaining` doesn't apply. */
  unlimited: boolean;
  next_heart_at: string | null;
  /** True when this (practice) attempt earned a heart back (≥ threshold score). */
  earned: boolean;
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

/** Legendary-run outcome on the completion payload (gameplay doc §1.5). */
export interface LegendaryResult {
  attempted: boolean;
  earned: boolean;
}

export interface CompleteResponse {
  score_pct: number;
  correct_count: number;
  total_count: number;
  /** null on challenge/practice attempts — no stars/pass-fail framing there. */
  stars: number | null;
  passed: boolean | null;
  xp: XpBreakdown;
  hearts: HeartsState;
  streak: StreakState;
  unlocked_level_id: number | null;
  achievements_unlocked: AchievementUnlocked[];
  review: ReviewEntry[];
  /** Absent/null on plain attempts from older payloads. */
  legendary?: LegendaryResult | null;
}

// ---------------------------------------------------------------------------
// Gamification summary
// ---------------------------------------------------------------------------

export interface MeGame {
  xp_total: number;
  hearts: number;
  /** Premium / signup grace period: render the infinity heart. */
  hearts_unlimited: boolean;
  next_heart_at: string | null;
  streak_current: number;
  streak_longest: number;
  /** Streak freezes currently held (0–2). Optional: older payloads omit it. */
  streak_freezes?: number;
  league: {
    /** Tier info object (older payloads sent the bare tier name as a string). */
    tier: LeagueTierInfo | string;
    rank: number;
    xp_week: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Leagues / leaderboards
// ---------------------------------------------------------------------------

export interface LeagueTierInfo {
  /** Pre-formatted French name — fallback only; localize via `order` instead. */
  name: string;
  /** Lucide icon name (kebab-case). */
  icon: string;
  color_hex: string;
  /** Stable 1 (Bronze) .. 5 (Cèdre) rank — the localization key, not `name`. */
  order: number;
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  display_name: string;
  avatar_id: string;
  xp_week: number;
  is_me: boolean;
}

/**
 * GET /league/ — rows may be [] with rank null when the user hasn't earned
 * XP this week (« Gagne de l'XP pour rejoindre la ligue de la semaine ! »).
 */
export interface LeagueResponse {
  tier: LeagueTierInfo | null;
  rank: number | null;
  xp_week: number;
  week_ends_at: string;
  promote_count: number;
  demote_count: number;
  rows: LeaderboardRow[];
}

// ---------------------------------------------------------------------------
// Quests / achievements / stats
// ---------------------------------------------------------------------------

export interface DailyGoalProgress {
  target: number;
  current: number;
}

export interface QuestItem {
  code: string;
  title: string;
  target: number;
  current: number;
  done: boolean;
}

export interface QuestsToday {
  daily_goal: DailyGoalProgress;
  quests: QuestItem[];
}

export interface AchievementItem {
  code: string;
  title: string;
  description: string;
  /** Lucide icon name (kebab-case). */
  icon: string;
  order: number;
  is_premium_only: boolean;
  unlocked_at: string | null;
  threshold: number;
  /** Optional current progress toward `threshold` — render a bar only when present. */
  progress?: number | null;
}

/** Lightweight subject reference used in stats payloads. */
export interface SubjectRef {
  name: string;
  slug: string;
  color_hex: string;
  icon: string;
}

export interface StatsTotals {
  xp_total: number;
  levels_completed: number;
  perfect_levels: number;
  best_streak: number;
}

/**
 * GET /me/stats/ per_subject row — `subject` is the bare slug and `name` is
 * a sibling field (backend/apps/progress/services/stats.py::_per_subject);
 * there is no nested SubjectRef here, unlike other subject-bearing payloads.
 */
export interface SubjectStat {
  subject: string;
  name: string;
  accuracy_pct: number;
  answered: number;
  levels_completed: number;
  stars_total: number;
}

export interface XpByDayEntry {
  date: string;
  xp: number;
}

/** GET /me/stats/ — per_subject/xp_by_day only when `detailed` (premium). */
export interface MeStats {
  detailed: boolean;
  totals: StatsTotals;
  per_subject?: SubjectStat[];
  xp_by_day?: XpByDayEntry[];
}

// ---------------------------------------------------------------------------
// Friends / user search
// ---------------------------------------------------------------------------

export interface PublicUser {
  user_id: number;
  username: string;
  display_name: string;
  avatar_id: string;
}

export interface Friend extends PublicUser {
  xp_week: number;
}

export interface FriendRequestIncoming {
  id: number;
  from: PublicUser;
}

export interface FriendRequestOutgoing {
  id: number;
  to: PublicUser;
}

export interface FriendRequests {
  incoming: FriendRequestIncoming[];
  outgoing: FriendRequestOutgoing[];
}

export type FriendshipStatus = 'none' | 'friends' | 'pending_out' | 'pending_in';

export interface UserSearchResult extends PublicUser {
  friendship_status: FriendshipStatus;
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'completed';

export interface ChallengeLevelRef {
  id: number;
  title: string;
  subject: SubjectRef;
}

interface ChallengeBase {
  id: number;
  level: ChallengeLevelRef;
  status: ChallengeStatus;
  challenger_score: number | null;
  opponent_score: number | null;
  winner_username: string | null;
  expires_at: string;
}

/** Challenge someone sent ME — the other player is the challenger. */
export interface IncomingChallenge extends ChallengeBase {
  challenger: PublicUser;
}

/** Challenge I sent — the other player is the opponent. */
export interface OutgoingChallenge extends ChallengeBase {
  opponent: PublicUser;
}

export interface ChallengesResponse {
  incoming: IncomingChallenge[];
  outgoing: OutgoingChallenge[];
}

/** Per-question comparison — present on the detail payload after completion. */
export interface ChallengeQuestionCompare {
  challenger_correct: boolean;
  opponent_correct: boolean;
  text?: string | null;
}

export interface ChallengeDetail extends ChallengeBase {
  challenger?: PublicUser;
  opponent?: PublicUser;
  questions?: ChallengeQuestionCompare[];
}

export interface CreateChallengePayload {
  opponent_id: number;
  level_id: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** DRF error body: {detail: "..."} or {field: ["msg", ...]}. */
export type ApiErrorBody = { detail?: string } & Record<string, string[] | string | undefined>;

/**
 * Business-rule error codes on the attempt endpoints (PLAN decision 1):
 * 402 `premium_required`, 409 `out_of_hearts`,
 * 409 `attempt_in_progress` (+ `extra.attempt_id`),
 * 403 `legendary_locked` (legendary start without the 3-star unlock).
 */
export type AttemptErrorCode =
  | 'premium_required'
  | 'out_of_hearts'
  | 'attempt_in_progress'
  | 'legendary_locked';

export interface CodedErrorBody {
  detail?: string;
  code?: string;
  extra?: {
    attempt_id?: number;
  };
}
