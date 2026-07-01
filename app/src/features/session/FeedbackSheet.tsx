import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Landmark, Volume2, VolumeX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VideoView, useVideoPlayer } from 'expo-video';

import type { AnswerResponse, AttemptQuestion } from '@/api/types';
import { ClayButton } from '@/components/clay/ClayButton';
import { MathText } from '@/components/content/MathText';
import { Mascot } from '@/components/mascot/Mascot';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const CORRECT_VERDICTS = 4; // session:feedback.correct.1-4
const WRONG_VERDICTS = 3; // session:feedback.wrong.1-3

interface FeedbackSheetProps {
  answer: AnswerResponse;
  question: AttemptQuestion;
  /** « Continuer » — next question or completion. */
  onContinue: () => void;
}

/**
 * Non-dismissable feedback bottom-sheet (design_mobile.md §4b): verdict strip,
 * formula-aware explanation, provenance chip, 9:16 media slot, mini mascot,
 * full-width themed « Continuer ».
 */
export function FeedbackSheet({ answer, question, onContinue }: FeedbackSheetProps) {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const snapPoints = useMemo(() => ['45%', '90%'], []);

  // Random verdict line, stable for this answer (component mounts per feedback).
  const [verdictIndex] = useState(
    () => 1 + Math.floor(Math.random() * (answer.is_correct ? CORRECT_VERDICTS : WRONG_VERDICTS)),
  );
  const verdict = answer.is_correct
    ? t(`feedback.correct.${verdictIndex}`)
    : t(`feedback.wrong.${verdictIndex}`);

  const tint = answer.is_correct ? colors.success : colors.heartsRed;
  const provenance = buildProvenance(question, t);

  return (
    <BottomSheet
      animateOnMount
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      handleIndicatorStyle={styles.handle}
      index={0}
      snapPoints={snapPoints}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="feedback-sheet"
      >
        <View style={styles.verdictRow}>
          <View style={styles.verdictText}>
            <Text style={[styles.verdict, { color: tint }]} testID="feedback-verdict">
              {verdict}
            </Text>
            {provenance ? (
              <View style={styles.chip} testID="provenance-chip">
                <Landmark color={colors.neutral[500]} size={14} />
                <Text style={styles.chipText}>{provenance}</Text>
              </View>
            ) : null}
          </View>
          <Mascot size={72} state={answer.is_correct ? 'celebrate' : 'sad'} />
        </View>

        {answer.explanation_text ? (
          <View style={styles.explanation}>
            <Text style={styles.explanationTitle}>{t('feedback.explanationTitle')}</Text>
            <MathText color={colors.neutral[700]} fontSize={15} text={answer.explanation_text} />
          </View>
        ) : null}

        {answer.explanation_media_url ? (
          <MediaSlot type={answer.explanation_media_type} url={answer.explanation_media_url} />
        ) : null}
      </BottomSheetScrollView>

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
    </BottomSheet>
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

/** 9:16 rounded media: image, or muted-autoplay video (tap to unmute). */
function MediaSlot({ url, type }: { url: string; type: AnswerResponse['explanation_media_type'] }) {
  if (type === 'video') return <FeedbackVideo url={url} />;
  return (
    <Image
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
  handle: {
    backgroundColor: colors.neutral[300],
  },
  content: {
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
    gap: spacing.l,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  verdictText: {
    flex: 1,
    gap: spacing.s,
  },
  verdict: {
    ...typography.h1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  chipText: {
    ...typography.caption,
    color: colors.neutral[700],
  },
  explanation: {
    gap: spacing.s,
  },
  explanationTitle: {
    ...typography.h2,
    color: colors.neutral[900],
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
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.neutral[0],
  },
});
