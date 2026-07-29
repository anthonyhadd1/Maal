import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AnswerResponse } from '@/api/types';
import { AnswerOption } from '@/features/session/AnswerOption';
import { choiceRevealState } from '@/features/session/QuestionRenderer/types';
import type { SessionAnswerRecord } from '@/stores/sessionStore';
import { wrongAnswer } from '@/test/fixtures/session';
import { colors } from '@/theme/tokens';

/** choiceRevealState takes the persisted SessionAnswerRecord, not the raw
 * server AnswerResponse — wrap the fixture with the one extra field. */
function verdict(overrides: Partial<AnswerResponse> = {}): SessionAnswerRecord {
  const response = wrongAnswer(overrides);
  return { selected: [], ...response };
}

const ACCENT = colors.primary[500];

describe('AnswerOption reveal states', () => {
  test('idle: tappable, no verdict icons', async () => {
    const onPress = jest.fn();
    await render(
      <AnswerOption accent={ACCENT} onPress={onPress} state="idle" testID="opt" text="98 g/mol" />,
    );

    expect(screen.queryByTestId('answer-icon-check')).toBeNull();
    expect(screen.queryByTestId('answer-icon-cross')).toBeNull();

    await fireEvent.press(screen.getByTestId('opt'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('selected: exposes the a11y selected state', async () => {
    await render(
      <AnswerOption accent={ACCENT} onPress={() => {}} state="selected" testID="opt" text="A" />,
    );
    expect(screen.getByTestId('opt')).toBeSelected();
  });

  test('correct: check icon, no longer pressable', async () => {
    const onPress = jest.fn();
    await render(
      <AnswerOption accent={ACCENT} onPress={onPress} state="correct" testID="opt" text="A" />,
    );

    expect(screen.getByTestId('answer-icon-check')).toBeTruthy();
    expect(screen.queryByTestId('answer-icon-cross')).toBeNull();

    await fireEvent.press(screen.getByTestId('opt'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('wrong: cross icon shown', async () => {
    await render(
      <AnswerOption accent={ACCENT} onPress={() => {}} state="wrong" testID="opt" text="B" />,
    );
    expect(screen.getByTestId('answer-icon-cross')).toBeTruthy();
    expect(screen.queryByTestId('answer-icon-check')).toBeNull();
  });

  test('revealCorrect (the true answer the user missed): green check highlight', async () => {
    await render(
      <AnswerOption
        accent={ACCENT}
        onPress={() => {}}
        state="revealCorrect"
        testID="opt"
        text="C"
      />,
    );
    expect(screen.getByTestId('answer-icon-check')).toBeTruthy();
  });

  test('multi variant renders its checkbox affordance', async () => {
    await render(
      <AnswerOption
        accent={ACCENT}
        multi
        onPress={() => {}}
        state="idle"
        testID="opt"
        text="HCl"
      />,
    );
    expect(screen.getByTestId('opt-checkbox')).toBeTruthy();
  });
});

describe('choiceRevealState (server verdict → per-choice states)', () => {
  test('before reveal: only idle/selected', () => {
    expect(choiceRevealState(1, [], null)).toBe('idle');
    expect(choiceRevealState(1, [1], null)).toBe('selected');
  });

  test('after reveal: wrong pick turns red, the true answer highlights green, rest dim', () => {
    // User picked 2; the correct choice is 1 (fixture).
    const v = verdict({ correct_choice_ids: [1] });
    expect(choiceRevealState(2, [2], v)).toBe('wrong');
    expect(choiceRevealState(1, [2], v)).toBe('revealCorrect');
    expect(choiceRevealState(3, [2], v)).toBe('dimmed');
  });

  test('after reveal: correct pick turns green', () => {
    const v = verdict({ is_correct: true, correct_choice_ids: [1] });
    expect(choiceRevealState(1, [1], v)).toBe('correct');
  });
});
