import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AttemptQuestion } from '@/api/types';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { MathText } from '@/components/content/MathText';
import { QuestionRenderer } from '@/features/session/QuestionRenderer';
import { formatCorrectLetters } from '@/features/session/FeedbackSheet';
import { shade, withAlpha } from '@/lib/color';
import type { SessionAnswerRecord } from '@/stores/sessionStore';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface QuestionCardProps {
  question: AttemptQuestion;
  index: number;
  total: number;
  accent: string;
  height: number;
  /** This question's persisted verdict — null until answered. */
  answer: SessionAnswerRecord | null;
  submitting: boolean;
  onSubmit: (selectedChoiceIds: number[]) => void;
  /** Fires once, the first time this card renders (marks "seen" for time_ms). */
  onShown: () => void;
  /** Only the very first card gets the swipe-discoverability hint — the
   * gesture itself is new (this replaces a "tap Continuer to advance"
   * flow), so a first-time player needs some cue it exists at all. */
  showSwipeHint?: boolean;
  /** Explicit navigation — see the footer comment for why buttons are required. */
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  isLast: boolean;
}

/**
 * One full-screen "slide" of the swipe-card session pager: the question
 * itself, choices, and a footer that's either the Vérifier CTA (unanswered)
 * or a quiet inline review (answered — no mascot/banner replay, that
 * celebration already happened once via the FeedbackSheet overlay).
 */
export function QuestionCard({
  question,
  index,
  total,
  accent,
  height,
  answer,
  submitting,
  onSubmit,
  onShown,
  showSwipeHint = false,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  isLast,
}: QuestionCardProps) {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const [selected, setSelected] = useState<number[]>(answer?.selected ?? []);
  const isMulti = question.qtype === 'multi';
  const answered = answer != null;

  /**
   * The inner ScrollView is enabled ONLY when the content genuinely overflows.
   *
   * A vertical scroller nested inside the vertical pager consumes the pan
   * gesture before the pager sees it, so an always-scrollable card silently
   * ate every swipe — which is why long questions, figure questions and (once
   * the explanation appeared) every answered card felt "stuck". Most cards fit
   * comfortably; leaving scrolling off for those removes the nested scroll
   * region entirely and the swipe just works.
   */
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const overflows = contentHeight > viewportHeight + 1;

  useEffect(() => {
    onShown();
    // Fires once per mount — `onShown` is stable (engine.markShown), the
    // card itself never remounts with a different question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggle = (choiceId: number) => {
    if (answered || submitting) return;
    if (isMulti) {
      setSelected((prev) =>
        prev.includes(choiceId) ? prev.filter((id) => id !== choiceId) : [...prev, choiceId],
      );
    } else {
      setSelected([choiceId]);
    }
  };

  return (
    <View style={[styles.card, { height }]} testID={`question-card-${question.id}`}>
      <ScrollView
        contentContainerStyle={styles.content}
        onContentSizeChange={(_w, h) => setContentHeight(Math.round(h))}
        onLayout={(e) => setViewportHeight(Math.round(e.nativeEvent.layout.height))}
        scrollEnabled={overflows}
        showsVerticalScrollIndicator={overflows}
        testID="question-content-scroll"
      >
        <View style={[styles.counterChip, { backgroundColor: withAlpha(accent, 0.12) }]}>
          <Text style={[styles.counter, { color: shade(accent, -0.35) }]}>
            {t('questionCounter', { n: index + 1, total })}
          </Text>
        </View>

        {/* Centers a short question (few choices, no image/passage) in the
            remaining card height instead of leaving it stranded at the top
            with a slab of dead space below — a full-screen card makes that
            gap much more visible than the old scrolling single-question
            layout ever did. Content taller than the card (long passages,
            the post-answer explanation) simply overflows into normal
            top-anchored scroll, same as before. */}
        <View style={styles.body}>
          <QuestionRenderer
            accent={accent}
            disabled={answered || submitting}
            onToggle={onToggle}
            question={question}
            revealed={answer}
            selected={answered ? answer.selected : selected}
          />

          {answered ? <InlineReview answer={answer} question={question} /> : null}
        </View>
      </ScrollView>

      {/* Navigation is ALWAYS present, answered or not.
          Two reasons it cannot be swipe-only:
          - a card that overflows keeps its inner scroller, which eats the pan
            before the pager sees it (that is the bug this footer fixes);
          - `gesture-alternative`: a critical action must have a visible
            control. Skipping a question you cannot answer is critical here —
            the pager's whole premise is that you may answer in any order. */}
      <View style={styles.footer}>
        {showSwipeHint && !answered ? (
          <View style={styles.swipeHint} testID="swipe-hint">
            <ChevronUp color={colors.neutral[500]} size={14} strokeWidth={2.4} />
            <Text style={styles.swipeHintText}>{t('swipeHint')}</Text>
          </View>
        ) : null}

        <View style={styles.footerRow}>
          <NavButton
            accessibilityLabel={t('nav.previous')}
            direction="prev"
            disabled={!canGoPrev}
            onPress={onPrev}
            testID="question-prev"
          />

          {answered ? (
            <ClayButton
              disabled={!canGoNext && !isLast}
              onPress={onNext}
              size="l"
              style={styles.primarySlot}
              testID="question-next-cta"
              title={isLast ? t('nav.lastAnswered') : t('nav.next')}
              variant="primary"
            />
          ) : (
            <ClayButton
              disabled={selected.length === 0 || submitting}
              loading={submitting}
              onPress={() => onSubmit(selected)}
              size="l"
              style={styles.primarySlot}
              testID="session-check"
              title={isMulti ? t('cta.validate') : tCommon('cta.check')}
              variant="primary"
            />
          )}

          {/* Skip-ahead stays available while unanswered — the answered state
              promotes "suivante" to the primary button, so a second one there
              would be a duplicate primary action. */}
          {!answered ? (
            <NavButton
              accessibilityLabel={t('nav.next')}
              direction="next"
              disabled={!canGoNext}
              onPress={onNext}
              testID="question-next"
            />
          ) : (
            <View style={styles.navSpacer} />
          )}
        </View>
      </View>
    </View>
  );
}

/** 44pt clay icon button for one step of pager navigation. */
function NavButton({
  direction,
  disabled,
  onPress,
  accessibilityLabel,
  testID,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
}) {
  const Icon = direction === 'next' ? ChevronUp : ChevronDown;
  return (
    <ClayIconButton
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      size={NAV_BUTTON_SIZE}
      testID={testID}
    >
      <Icon
        color={disabled ? colors.neutral[300] : colors.neutral[700]}
        size={22}
        strokeWidth={2.6}
      />
    </ClayIconButton>
  );
}

/** Apple HIG / Material minimum touch target. */
const NAV_BUTTON_SIZE = 44;

/**
 * Quiet, non-celebratory recap shown when swiping BACK to an already-graded
 * card — the colored choices (via `revealed` above) already say correct/
 * wrong; this just restates the explanation without replaying the mascot/
 * verdict banner from FeedbackSheet (that moment already happened once).
 */
function InlineReview({
  answer,
  question,
}: {
  answer: SessionAnswerRecord;
  question: AttemptQuestion;
}) {
  const { t } = useTranslation('session');
  const Icon = answer.is_correct ? CheckCircle2 : XCircle;
  const tint = answer.is_correct ? colors.successEdge : colors.dangerDeep;

  return (
    <View style={styles.review} testID="inline-review">
      <View style={styles.reviewBadge}>
        <Icon color={tint} size={16} strokeWidth={2.4} />
        <Text style={[styles.reviewBadgeText, { color: tint }]}>
          {answer.is_correct ? t('reviewed.correct') : t('reviewed.wrong')}
        </Text>
      </View>

      {answer.explanation_text ? (
        <ClayCard radius="l" style={styles.explanation}>
          <View style={styles.correctAnswerRow}>
            <Text style={styles.correctAnswerLabel}>{t('feedback.correctAnswer')}</Text>
            <Text style={styles.correctAnswerValue}>
              {formatCorrectLetters(question, answer.correct_choice_ids)}
            </Text>
          </View>
          <MathText color={colors.neutral[700]} fontSize={15} text={answer.explanation_text} />
        </ClayCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    paddingBottom: spacing.xxl,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  counterChip: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    marginBottom: spacing.m,
  },
  counter: {
    ...typography.caption,
    fontFamily: typography.h2.fontFamily,
    letterSpacing: 0.4,
  },
  footer: {
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
    paddingTop: spacing.s,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  primarySlot: {
    flex: 1,
  },
  /** Keeps the primary button optically centred when the next arrow is hidden. */
  navSpacer: {
    width: NAV_BUTTON_SIZE,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.s,
  },
  swipeHintText: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  review: {
    marginTop: spacing.xl,
    gap: spacing.m,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  reviewBadgeText: {
    ...typography.smallMedium,
  },
  explanation: {
    gap: spacing.s,
  },
  correctAnswerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  correctAnswerLabel: {
    ...typography.smallMedium,
    color: colors.neutral[500],
  },
  correctAnswerValue: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
    color: colors.successEdge,
  },
});
