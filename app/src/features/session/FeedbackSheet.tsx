import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Landmark, Volume2, VolumeX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VideoView, useVideoPlayer } from 'expo-video';

import type { AttemptQuestion, ExplanationMediaType } from '@/api/types';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { MathText } from '@/components/content/MathText';
import { Mascot } from '@/components/mascot/Mascot';
import { withAlpha } from '@/lib/color';
import type { SessionAnswerRecord } from '@/stores/sessionStore';
import { colors, radii, scrim, shadows, spacing, typography } from '@/theme/tokens';

const CORRECT_VERDICTS = 4; // session:feedback.correct.1-4
const WRONG_VERDICTS = 3; // session:feedback.wrong.1-3
const LETTERS = 'ABCDEFGH';

interface FeedbackSheetProps {
  answer: SessionAnswerRecord;
  question: AttemptQuestion;
  /** « Continuer » — dismiss this card's feedback overlay. */
  onContinue: () => void;
}

/**
 * Non-dismissable feedback bottom-sheet (design_mobile.md §4b): gradient
 * verdict strip + mini mascot, provenance « stamp », clay explanation card,
 * 9:16 media slot, full-width themed « Continuer ».
 */
export function FeedbackSheet({ answer, question, onContinue }: FeedbackSheetProps) {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  // Single snap: the sheet container matches the visible height, so the
  // « Continuer » footer can sit in normal flow (pinned, works on web too).
  // Long explanations/media scroll inside the sheet.
  const snapPoints = useMemo(() => ['54%'], []);

  // Random verdict line, stable for this answer (component mounts per feedback).
  const [verdictIndex] = useState(
    () => 1 + Math.floor(Math.random() * (answer.is_correct ? CORRECT_VERDICTS : WRONG_VERDICTS)),
  );
  const verdict = answer.is_correct
    ? t(`feedback.correct.${verdictIndex}`)
    : t(`feedback.wrong.${verdictIndex}`);

  // successDeep/successEdge (not success itself) so white verdict text holds
  // >=3:1 against both stops — colors.success measured only 2.28:1.
  const gradient: readonly [string, string] = answer.is_correct
    ? [colors.successDeep, colors.successEdge]
    : [colors.heartsRed, colors.dangerDeep];
  const provenance = buildProvenance(question, t);

  return (
    <>
    <BottomSheet
      animateOnMount
      backdropComponent={FeedbackBackdrop}
      backgroundStyle={styles.sheetBackground}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      handleIndicatorStyle={styles.handle}
      index={0}
      snapPoints={snapPoints}
      style={styles.sheet}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="feedback-sheet"
      >
        {/* Verdict strip: success/danger gradient + mini mascot pose. */}
        <View style={styles.verdictStrip}>
          <LinearGradient
            colors={gradient}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.verdictText}>
            <Text style={styles.verdict} testID="feedback-verdict">
              {verdict}
            </Text>
            {provenance ? (
              <View style={styles.stamp} testID="provenance-chip">
                <Landmark color={colors.neutral[0]} size={13} strokeWidth={2.4} />
                <Text style={styles.stampText}>{provenance}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.mascotWell}>
            <Mascot size={64} state={answer.is_correct ? 'celebrate' : 'sad'} />
          </View>
        </View>

        {answer.explanation_text ? (
          <ClayCard radius="l" style={styles.explanation}>
            <Text style={styles.explanationTitle}>{t('feedback.explanationTitle')}</Text>
            {/* Restates WHICH choice(s) were correct — the choice list above
                (color-coded) can be scrolled out of view by the time this
                sheet appears, leaving the explanation with no textual anchor
                to a specific letter otherwise. */}
            <View style={styles.correctAnswerRow}>
              <Text style={styles.correctAnswerLabel}>{t('feedback.correctAnswer')}</Text>
              <Text style={styles.correctAnswerValue}>
                {formatCorrectLetters(question, answer.correct_choice_ids)}
              </Text>
            </View>
            <MathText color={colors.neutral[700]} fontSize={16} text={answer.explanation_text} />
          </ClayCard>
        ) : answer.explanation_text === null ? (
          // Legendary run: the server withholds explanations until the end.
          <View style={styles.withheldChip} testID="legendary-withheld">
            <Crown color={colors.goldDeep} fill={colors.goldDeep} size={14} />
            <Text style={styles.withheldText}>{t('legendary.withheld')}</Text>
          </View>
        ) : null}

        {answer.explanation_media_url ? (
          <MediaSlot type={answer.explanation_media_type} url={answer.explanation_media_url} />
        ) : null}
      </BottomSheetScrollView>
    </BottomSheet>

    {/* CTA pinned to the SCREEN, over the sheet — the sheet's inner container
        is full-height + translated on web, so in-sheet pinning is unreliable. */}
    <View style={styles.footer}>
      <ClayButton
        fullWidth
        onPress={onContinue}
        size="l"
        testID="feedback-continue"
        title={tCommon('cta.continue')}
        variant={answer.is_correct ? 'success' : 'danger'}
      />
    </View>
    </>
  );
}

/**
 * Scrim behind the feedback sheet.
 *
 * The sheet is deliberately non-dismissable — but with no backdrop the swipe
 * pager underneath stayed fully live: a stray horizontal drag moved the student
 * to another question while the verdict for the previous one was still up.
 * `pressBehavior="none"` keeps it undismissable while `pointerEvents: 'auto'`
 * (the default when touch-through is off) actually blocks that leak. The scrim
 * also darkens the pager, so the verdict finally reads as the focused layer
 * instead of a panel floating over live content.
 *
 * Hidden from screen readers: it is a visual/touch barrier, not a control —
 * the library's own default label says "Tap to none the Bottom Sheet".
 */
function FeedbackBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      accessible={false}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="none"
      style={[props.style, styles.backdrop]}
    />
  );
}

function buildProvenance(
  question: AttemptQuestion,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!question.exam_year) return null;
  if (question.exam_session) {
    return t('provenanceFull', { year: question.exam_year, session: question.exam_session });
  }
  return t('provenance', { year: question.exam_year });
}

/** "B" (single/true-false) or "B, D" (multi) — matches the A/B/C… badges
 * AnswerOption renders for each choice, by position in `question.choices`. */
export function formatCorrectLetters(question: AttemptQuestion, correctChoiceIds: number[]): string {
  const letters = question.choices
    .map((choice, index) => (correctChoiceIds.includes(choice.id) ? LETTERS[index] : null))
    .filter((letter): letter is string => letter != null);
  return letters.join(', ');
}

/** 9:16 rounded media: image, or muted-autoplay video (tap to unmute). */
function MediaSlot({ url, type }: { url: string; type: ExplanationMediaType | null }) {
  const { t } = useTranslation('session');
  if (type === 'video') return <FeedbackVideo url={url} />;
  return (
    <Image
      accessibilityLabel={t('media.explanationImage')}
      resizeMode="cover"
      source={{ uri: url }}
      style={styles.media}
      testID="feedback-media-image"
    />
  );
}

function FeedbackVideo({ url }: { url: string }) {
  const { t } = useTranslation('session');
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const toggleMute = () => {
    const next = !muted;
    player.muted = next;
    setMuted(next);
  };

  return (
    <Pressable
      accessibilityLabel={muted ? t('media.unmute') : t('media.mute')}
      accessibilityRole="button"
      onPress={toggleMute}
      style={styles.media}
      testID="feedback-media-video"
    >
      <VideoView contentFit="cover" nativeControls={false} player={player} style={styles.video} />
      <View style={styles.muteBadge}>
        {muted ? (
          <VolumeX color={colors.neutral[0]} size={18} />
        ) : (
          <Volume2 color={colors.neutral[0]} size={18} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    ...shadows.clayFloating,
  },
  backdrop: {
    backgroundColor: scrim,
  },
  sheetBackground: {
    backgroundColor: colors.neutral[50],
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  handle: {
    backgroundColor: colors.neutral[300],
    width: 44,
  },
  content: {
    paddingHorizontal: spacing.l,
    // Clears the pinned footer (56px CTA + vertical padding).
    paddingBottom: 96,
    gap: spacing.l,
  },
  verdictStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderRadius: radii.l,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    overflow: 'hidden',
    ...shadows.clayRaised,
  },
  verdictText: {
    flex: 1,
    gap: spacing.s,
    paddingVertical: spacing.xs,
  },
  verdict: {
    ...typography.h1,
    color: colors.neutral[0],
  },
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.55)',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: radii.s,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
  },
  stampText: {
    ...typography.caption,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[0],
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mascotWell: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  explanation: {
    gap: spacing.s,
  },
  explanationTitle: {
    ...typography.h2,
    color: colors.neutral[900],
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
    // successDeep only holds ~3.3:1 against this card's white background,
    // below the 4.5:1 minimum (same fix as LeagueBadge's promote caption).
    color: colors.successEdge,
  },
  withheldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    backgroundColor: withAlpha(colors.xpGold, 0.16),
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  withheldText: {
    ...typography.caption,
    color: colors.goldDeep,
  },
  media: {
    alignSelf: 'center',
    width: 200,
    aspectRatio: 9 / 16,
    borderRadius: radii.m,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  muteBadge: {
    position: 'absolute',
    bottom: spacing.s,
    right: spacing.s,
    backgroundColor: colors.neutral[900],
    borderRadius: radii.pill,
    padding: spacing.xs,
    opacity: 0.85,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
    backgroundColor: colors.neutral[50],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
});
