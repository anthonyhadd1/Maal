import type { AttemptQuestion } from '@/api/types';
import type { SessionAnswerRecord } from '@/stores/sessionStore';

/**
 * Discriminated rendering kinds (design_mobile.md §4b): derived from `qtype`
 * plus the PRESENCE of an image/passage — a passage MCQ renders the passage
 * shell around the base choice list, an image question shows the zoomable
 * image above it. Extensible for tomorrow's real data format.
 */
export type QuestionKind = 'single' | 'multi' | 'trueFalse' | 'image' | 'passage';

export function classifyQuestion(question: AttemptQuestion): QuestionKind {
  if (question.passage) return 'passage';
  if (question.image_url) return 'image';
  if (question.qtype === 'multi') return 'multi';
  if (question.qtype === 'true_false') return 'trueFalse';
  return 'single';
}

/**
 * True when every choice carries its own figure — i.e. the answer options ARE
 * images (real exam "which of these curves is f?" questions). Such choices get
 * the large uncropped image treatment instead of a thumbnail-beside-text row.
 */
export function allChoicesAreImages(question: AttemptQuestion): boolean {
  return question.choices.length > 0 && question.choices.every((c) => !!c.image_url);
}

/** Visual state of one answer option through the select→reveal lifecycle. */
export type RevealState = 'idle' | 'selected' | 'correct' | 'wrong' | 'revealCorrect' | 'dimmed';

/**
 * Post-grade state per choice: the user's pick turns green/red, the true
 * answer(s) highlight green simultaneously, the rest dim out.
 */
export function choiceRevealState(
  choiceId: number,
  selected: number[],
  revealed: SessionAnswerRecord | null,
): RevealState {
  const isSelected = selected.includes(choiceId);
  if (!revealed) return isSelected ? 'selected' : 'idle';
  const isCorrectChoice = revealed.correct_choice_ids.includes(choiceId);
  if (isSelected && isCorrectChoice) return 'correct';
  if (isSelected) return 'wrong';
  if (isCorrectChoice) return 'revealCorrect';
  return 'dimmed';
}

/** Props shared by every question-type renderer. */
export interface RendererProps {
  question: AttemptQuestion;
  accent: string;
  selected: number[];
  /** Tap on a choice (select for single/TF, toggle for multi). */
  onToggle: (choiceId: number) => void;
  /** This question's persisted verdict — set once answered, null until then
   *  (drives both the just-submitted reveal AND revisiting a past card). */
  revealed: SessionAnswerRecord | null;
  /** Block interaction (submitting, or already answered). */
  disabled: boolean;
}
