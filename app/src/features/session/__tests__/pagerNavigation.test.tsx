import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

import type { AttemptQuestion } from '@/api/types';
import { QuestionCard } from '@/features/session/QuestionCard';
import { i18nReady } from '@/i18n';
import { singleQuestion } from '@/test/fixtures/session';
import { colors } from '@/theme/tokens';

/**
 * Swipe coverage.
 *
 * Every card wraps its content in a ScrollView. A vertical scroller nested
 * inside the vertical pager consumes the pan gesture before the pager sees it,
 * so on any card whose content overflowed — figure questions, long stems, and
 * EVERY answered card once the explanation is appended — swiping up did
 * nothing. Two guarantees are locked here:
 *
 *  1. the inner scroller is only enabled when the content genuinely overflows,
 *     so ordinary cards have no nested scroll region at all;
 *  2. navigation never depends on the gesture — real buttons are always
 *     present (`gesture-alternative`).
 *
 * Note for anyone extending this file: every act() here MUST be awaited.
 * An un-awaited act() in this act-aware environment corrupts the act scope
 * and every later render in the file silently yields an empty tree — which
 * looks exactly like a per-file render limit, but is not one.
 */

const noop = () => {};

const baseProps = {
  accent: colors.primary[500],
  height: 800,
  index: 1,
  total: 5,
  submitting: false,
  onShown: noop,
  onSubmit: noop,
  onPrev: noop,
  onNext: noop,
  canGoPrev: true,
  canGoNext: true,
  isLast: false,
};

const answered = {
  selected: [singleQuestion.choices[0].id],
  is_correct: true,
  correct_choice_ids: [singleQuestion.choices[0].id],
  explanation_text: 'Parce que la quantité conjuguée fait tendre le tout vers 0.',
  explanation_media_url: null,
  explanation_media_type: null,
};

type Props = Partial<React.ComponentProps<typeof QuestionCard>>;

async function mount(overrides: Props = {}) {
  const view = await render(
    <QuestionCard {...baseProps} answer={null} question={singleQuestion} {...overrides} />,
  );
  const scroller = () => view.getByTestId('question-content-scroll');
  /** Drive the ScrollView's own callbacks — RNTL's fireEvent does not forward
   *  onContentSizeChange's (width, height) signature. */
  const measure = async (viewport: number, content: number) => {
    const sv = scroller();
    // MUST be awaited: an un-awaited act() in this act-aware environment
    // corrupts the scope and every subsequent render in the file yields an
    // empty tree.
    await act(async () => {
      sv.props.onLayout({ nativeEvent: { layout: { height: viewport, width: 390, x: 0, y: 0 } } });
    });
    await act(async () => {
      sv.props.onContentSizeChange(390, content);
    });
  };
  return { ...view, scroller, measure };
}

beforeAll(async () => {
  await i18nReady;
});

// Auto-cleanup is not unmounting these trees; without an explicit unmount the
// renderer stops producing a tree after ~9 mounts in one file.
afterEach(cleanup);

describe('QuestionCard — navigation is never gesture-only', () => {
  test('an unanswered card exposes both previous and next controls', async () => {
    const v = await mount();

    expect(v.getByTestId('question-prev')).toBeTruthy();
    expect(v.getByTestId('question-next')).toBeTruthy();
    expect(v.getByTestId('session-check')).toBeTruthy();
  });

  test('an ANSWERED card still offers navigation — this was the worst-hit case', async () => {
    const v = await mount({ answer: answered });

    // The explanation makes answered cards the most likely to overflow, so a
    // gesture-only design left them the hardest to leave.
    expect(v.getByTestId('inline-review')).toBeTruthy();
    expect(v.getByTestId('question-prev')).toBeTruthy();
    expect(v.getByTestId('question-next-cta')).toBeTruthy();
  });

  test('the next control advances the pager', async () => {
    const onNext = jest.fn();
    const v = await mount({ onNext });

    fireEvent.press(v.getByTestId('question-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('the previous control steps back', async () => {
    const onPrev = jest.fn();
    const v = await mount({ onPrev });

    fireEvent.press(v.getByTestId('question-prev'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  test('an unanswered question can be SKIPPED — free navigation is the pager premise', async () => {
    const onNext = jest.fn();
    const onSubmit = jest.fn();
    const v = await mount({ onNext, onSubmit });

    // Nothing selected: Vérifier is disabled, but moving on must still work.
    fireEvent.press(v.getByTestId('question-next'));
    expect(onNext).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('the first card cannot go back and the last cannot go forward', async () => {
    const v = await mount({ canGoPrev: false, canGoNext: false, index: 0 });

    expect(v.getByTestId('question-prev').props.accessibilityState.disabled).toBe(true);
    expect(v.getByTestId('question-next').props.accessibilityState.disabled).toBe(true);
  });

  test('the last answered card offers finishing rather than a dead "next"', async () => {
    const v = await mount({ answer: answered, canGoNext: false, index: 4, isLast: true });

    expect(v.getByText('Terminer')).toBeTruthy();
  });
});

describe('QuestionCard — the nested scroller only exists when it must', () => {
  test('the scroller is wired to measure itself at all', async () => {
    const v = await mount();

    expect(typeof v.scroller().props.onLayout).toBe('function');
    expect(typeof v.scroller().props.onContentSizeChange).toBe('function');
  });

  test('content that fits leaves scrolling OFF, so the pager gets the gesture', async () => {
    const v = await mount();

    await v.measure(600, 420);
    expect(v.scroller().props.scrollEnabled).toBe(false);
  });

  test('content taller than the card turns scrolling ON so it stays reachable', async () => {
    const v = await mount();

    await v.measure(600, 1400);
    expect(v.scroller().props.scrollEnabled).toBe(true);
  });

  test('exactly-fitting content does not scroll (no phantom 1px scroller)', async () => {
    const v = await mount();

    await v.measure(600, 600);
    expect(v.scroller().props.scrollEnabled).toBe(false);
  });

  test('an overflowing card STILL has working buttons — the scroller eats the swipe', async () => {
    const onNext = jest.fn();
    const v = await mount({ onNext });

    await v.measure(600, 1400);
    expect(v.scroller().props.scrollEnabled).toBe(true);

    fireEvent.press(v.getByTestId('question-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('figure questions — the case the user actually reported', () => {
  const figureQuestion: AttemptQuestion = {
    ...singleQuestion,
    image_url: 'http://localhost/media/questions/schema.png',
  };

  test('a figure question carries working navigation even when it overflows', async () => {
    const onNext = jest.fn();
    const v = await mount({ question: figureQuestion, onNext });

    await v.measure(600, 1600);
    expect(v.scroller().props.scrollEnabled).toBe(true);

    fireEvent.press(v.getByTestId('question-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
