import { formatCorrectLetters } from '@/features/session/FeedbackSheet';
import type { AttemptQuestion } from '@/api/types';

function question(choiceIds: number[]): AttemptQuestion {
  return {
    id: 1,
    qtype: 'single',
    text: 'stem',
    image_url: null,
    passage: null,
    choices: choiceIds.map((id) => ({ id, text: `choice ${id}`, image_url: null })),
  };
}

describe('formatCorrectLetters', () => {
  test('single correct choice -> its letter by position, not its id', () => {
    // Choice ids are NOT sequential/aligned with position — the letter must
    // come from array index, never from the id itself.
    const q = question([501, 502, 503, 504]);
    expect(formatCorrectLetters(q, [503])).toBe('C');
  });

  test('first choice correct -> "A"', () => {
    const q = question([10, 20, 30]);
    expect(formatCorrectLetters(q, [10])).toBe('A');
  });

  test('multi-select -> letters in choice order, comma-separated', () => {
    const q = question([10, 20, 30, 40, 50]);
    expect(formatCorrectLetters(q, [40, 10])).toBe('A, D');
  });

  test('true/false (2 choices) -> "A" or "B"', () => {
    const q = question([1, 2]);
    expect(formatCorrectLetters(q, [2])).toBe('B');
  });

  test('no matching id -> empty string (never throws)', () => {
    const q = question([1, 2, 3]);
    expect(formatCorrectLetters(q, [999])).toBe('');
  });
});
