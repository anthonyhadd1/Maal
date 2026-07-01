import type {
  AnswerResponse,
  AttemptQuestion,
  CompleteResponse,
  StartAttemptResponse,
} from '@/api/types';

/**
 * Fixtures mirroring the PLAN reconciled contract EXACTLY (decision 1):
 * - POST /levels/{id}/attempts/  -> { attempt_id, questions } (no answers)
 * - POST /attempts/{id}/answers/ -> per-question verdict incl. hearts/combo
 * - POST /attempts/{id}/complete/ -> results payload
 */

export const LEVEL_ID = 7;
export const ATTEMPT_ID = 555;

export const singleQuestion: AttemptQuestion = {
  id: 101,
  qtype: 'single',
  text: 'Quelle est la masse molaire de $\\ce{H2SO4}$ ?',
  image_url: null,
  passage: null,
  exam_year: 2019,
  exam_session: 'juillet',
  choices: [
    { id: 1, text: '98 g/mol', image_url: null },
    { id: 2, text: '96 g/mol', image_url: null },
    { id: 3, text: '82 g/mol', image_url: null },
  ],
};

export const multiQuestion: AttemptQuestion = {
  id: 102,
  qtype: 'multi',
  text: 'Sélectionne les acides forts.',
  image_url: null,
  passage: null,
  choices: [
    { id: 4, text: 'HCl', image_url: null },
    { id: 5, text: 'CH3COOH', image_url: null },
    { id: 6, text: 'HNO3', image_url: null },
    { id: 7, text: 'H2CO3', image_url: null },
  ],
};

export const trueFalseQuestion: AttemptQuestion = {
  id: 103,
  qtype: 'true_false',
  text: "L'eau pure est un électrolyte fort.",
  image_url: null,
  passage: null,
  choices: [
    { id: 8, text: 'Vrai', image_url: null },
    { id: 9, text: 'Faux', image_url: null },
  ],
};

export const startAttemptResponse: StartAttemptResponse = {
  attempt_id: ATTEMPT_ID,
  questions: [singleQuestion, multiQuestion, trueFalseQuestion],
};

export function correctAnswer(overrides: Partial<AnswerResponse> = {}): AnswerResponse {
  return {
    is_correct: true,
    correct_choice_ids: [1],
    explanation_text: '$M = 2(1) + 32 + 4(16) = 98$ g/mol.',
    explanation_media_url: null,
    explanation_media_type: null,
    hearts_remaining: 5,
    hearts_unlimited: false,
    next_heart_at: null,
    combo: 1,
    ...overrides,
  };
}

export function wrongAnswer(overrides: Partial<AnswerResponse> = {}): AnswerResponse {
  return {
    is_correct: false,
    correct_choice_ids: [1],
    explanation_text: 'Pense à bien compter les 4 oxygènes !',
    explanation_media_url: null,
    explanation_media_type: null,
    hearts_remaining: 4,
    hearts_unlimited: false,
    next_heart_at: '2026-07-02T12:00:00Z',
    combo: 0,
    ...overrides,
  };
}

export const completeResponse: CompleteResponse = {
  score_pct: 66.7,
  correct_count: 2,
  total_count: 3,
  stars: 1,
  passed: true,
  xp: {
    base: 4,
    perfect_bonus: 0,
    combo_bonus: 0,
    first_clear_bonus: 10,
    total: 14,
  },
  hearts: { lost: 1, remaining: 4, next_heart_at: '2026-07-02T12:00:00Z' },
  streak: { current: 3, extended_today: true },
  unlocked_level_id: 8,
  achievements_unlocked: [],
  review: [],
};
